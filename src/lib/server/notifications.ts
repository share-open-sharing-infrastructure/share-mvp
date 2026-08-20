import webpush from 'web-push';
import { env } from '$env/dynamic/private';
import { vapidPublicKey } from '$lib/publicEnv';
import type { NotificationType } from '$lib/types/models.js';
import { texts } from '$lib/texts';
import type PocketBase from 'pocketbase';

let vapidConfigured = false;
let vapidWarned = false;

/**
 * web-push stores the VAPID details in module state, so they only need setting once — but NOT
 * at import time. `vite build`'s analyse pass imports every server node with an empty
 * `$env/dynamic/private`, and `setVapidDetails` throws on an empty subject/key (issue #627).
 * Called from `sendPushToUser` instead — by then SvelteKit has populated the dynamic env, so the
 * read sees the value the running instance was started with.
 * Returns false (logging once) instead of throwing — for a missing value AND for a non-empty but
 * malformed one, which `assertRequiredEnv()` waves through because it only checks non-emptiness.
 * A misconfiguration must not turn a lending-status change, or an invite-code registration whose
 * user record already exists, into a 500.
 */
function ensureVapidConfigured(): boolean {
	if (vapidConfigured) return true;
	const subject = env.VAPID_SUBJECT;
	const privateKey = env.VAPID_PRIVATE_KEY;
	const publicKey = vapidPublicKey();
	if (!subject || !privateKey || !publicKey) {
		if (!vapidWarned) {
			vapidWarned = true;
			console.error(
				'Web Push disabled: VAPID_SUBJECT, VAPID_PRIVATE_KEY and PUBLIC_VAPID_PUBLIC_KEY must all be set.'
			);
		}
		return false;
	}
	try {
		webpush.setVapidDetails(subject, publicKey, privateKey);
	} catch (err) {
		// Rejected by web-push: a VAPID_SUBJECT without a mailto:/https: scheme, or a key whose
		// decoded length is wrong. Set-but-invalid passes the startup validator, so this is the
		// only place that can catch it.
		if (!vapidWarned) {
			vapidWarned = true;
			console.error('Web Push disabled: web-push rejected the VAPID configuration.', err);
		}
		return false;
	}
	vapidConfigured = true;
	return true;
}

/** Minimum gap between new_message notifications for the same conversation (ms). */
export const MESSAGE_NOTIFICATION_COOLDOWN_MS = 60_000; // 1 minute — adjust to taste

/**
 * Returns true if a new_message notification for this recipient+conversation
 * was already sent within the cooldown window and a new one should be suppressed.
 */
export async function isMessageNotificationThrottled(
	pb: PocketBase,
	recipientId: string,
	conversationId: string
): Promise<boolean> {
	try {
		const recent = await pb.collection('notifications').getList(1, 1, {
			filter: pb.filter('recipient={:recipientId} && relatedId={:conversationId} && type="new_message"', {
				recipientId,
				conversationId,
			}),
			sort: '-created',
		});
		if (recent.items.length === 0) return false;
		const lastCreated = new Date(recent.items[0].created).getTime();
		return Date.now() - lastCreated < MESSAGE_NOTIFICATION_COOLDOWN_MS;
	} catch (err) {
		console.error('Failed to check notification throttle:', err);
		return false; // fail open — send the notification if the check itself fails
	}
}

/**
 * Creates a notification record in PocketBase for the given recipient.
 */
export async function createNotification(
	pb: PocketBase,
	recipientId: string,
	senderId: string | undefined,
	type: NotificationType,
	relatedId: string,
	body: string
): Promise<void> {
	try {
		await pb.collection('notifications').create({
			recipient: recipientId,
			sender: senderId,
			type,
			relatedId,
			body,
			read: false,
		});
	} catch (err) {
		console.error('Failed to create notification:', err);
	}
}

/**
 * Creates an in-app notification AND sends the matching push to a recipient in one call —
 * the pairing every call site needs (previously duplicated between `lending.server.ts`'s
 * `notifyUser` helper and an inline notification+push pair in `conversation.server.ts`'s
 * `sendMessage`). Defaults `url` to the conversation the notification is `relatedId` to,
 * which covers every current call site (all conversation-scoped notification types).
 */
export async function notifyAndPush(
	pb: PocketBase,
	params: {
		recipient: string;
		sender?: string;
		type: NotificationType;
		relatedId: string;
		body: string;
		url?: string;
	}
): Promise<void> {
	const { recipient, sender, type, relatedId, body } = params;
	const url = params.url ?? `/conversations/${relatedId}`;
	await createNotification(pb, recipient, sender, type, relatedId, body);
	await sendPushToUser(pb, recipient, texts.notifications.pushTitle, body, url);
}

/**
 * Sends a push notification to all registered devices of a user.
 * Stale subscriptions (HTTP 410 Gone) are automatically removed.
 */
export async function sendPushToUser(
	pb: PocketBase,
	userId: string,
	title: string,
	body: string,
	url: string
): Promise<void> {
	if (!ensureVapidConfigured()) return;

	let subscriptions;
	try {
		subscriptions = await pb
			.collection('push_subscriptions')
			.getFullList({ filter: pb.filter('user={:userId}', { userId }) });
	} catch (err) {
		console.error('Failed to fetch push subscriptions:', err);
		return;
	}

	const payload = JSON.stringify({ title, body, url });

	await Promise.allSettled(
		subscriptions.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: { p256dh: sub.p256dh, auth: sub.auth },
					},
					payload
				);
			} catch (err: unknown) {
				const status = (err as { statusCode?: number }).statusCode;
				if (status === 410 || status === 404) {
					// Subscription is no longer valid — remove it
					try {
						await pb.collection('push_subscriptions').delete(sub.id);
					} catch {
						// ignore cleanup errors
					}
				} else {
					console.error('Failed to send push notification:', err);
				}
			}
		})
	);
}
