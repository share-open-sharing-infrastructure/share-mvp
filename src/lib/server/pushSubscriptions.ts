import type PocketBase from 'pocketbase';

const PUSH_SUBSCRIPTIONS = 'push_subscriptions';

export interface PushSubscriptionKeys {
	p256dh: string;
	auth: string;
}

export interface PostPayload {
	endpoint: string;
	keys: PushSubscriptionKeys;
}

/**
 * Upsert a push subscription for a user.
 *
 * If the endpoint is already registered (e.g. from another login), the crypto
 * keys are refreshed on the existing record. Otherwise a new record is created.
 * A failed lookup is treated as "not found" to keep the happy path alive even
 * when the DB is temporarily unavailable.
 */
export async function upsertPushSubscription(
	pb: PocketBase,
	userId: string,
	{ endpoint, keys }: PostPayload
): Promise<void> {
	const { items: matchingSubscriptions } = await pb
		.collection(PUSH_SUBSCRIPTIONS)
		.getList(1, 1, { filter: `endpoint="${endpoint}"` })
		.catch(() => ({ items: [] as { id: string }[] }));

	const [existingSubscription] = matchingSubscriptions;

	if (existingSubscription) {
		await pb.collection(PUSH_SUBSCRIPTIONS).update(existingSubscription.id, {
			user: userId,
			p256dh: keys.p256dh,
			auth: keys.auth,
		});
	} else {
		await pb.collection(PUSH_SUBSCRIPTIONS).create({
			user: userId,
			endpoint,
			p256dh: keys.p256dh,
			auth: keys.auth,
		});
	}
}

/**
 * Delete a push subscription belonging to a specific user.
 *
 * The user filter prevents users from removing each other's subscriptions.
 * No-ops silently if the subscription no longer exists (e.g. already purged
 * by `sendPushToUser` after a 410 Gone response from the push service).
 */
export async function deletePushSubscription(
	pb: PocketBase,
	userId: string,
	endpoint: string
): Promise<void> {
	const { items: matchingSubscriptions } = await pb
		.collection(PUSH_SUBSCRIPTIONS)
		.getList(1, 1, { filter: `endpoint="${endpoint}" && user="${userId}"` })
		.catch(() => ({ items: [] as { id: string }[] }));

	const [existingSubscription] = matchingSubscriptions;

	if (existingSubscription) {
		await pb.collection(PUSH_SUBSCRIPTIONS).delete(existingSubscription.id);
	}
}
