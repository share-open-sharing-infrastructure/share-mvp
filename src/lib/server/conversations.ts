import type PocketBase from 'pocketbase';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import { OPEN_LENDING_STATES, lendingStatusFilter } from '$lib/lending';
import { createNotification, sendPushToUser } from '$lib/server/notifications';
import { requirementRegistry } from '$lib/server/lendingRequirements';

/**
 * Re-exported for the two server `load()`s in this route (`+layout.server.ts`,
 * `[conversationId]/+page.server.ts`) that historically imported it from here. The
 * implementation now lives in `$lib/conversationPartnerFields.ts` (outside `$lib/server`) so
 * that `conversationListRealtime.ts` — which runs client-side — can use it too, since
 * SvelteKit forbids importing `$lib/server/*` from client code.
 */
export { conversationFieldsWithSafePartners } from '$lib/conversationPartnerFields';

/**
 * Finds an in-progress conversation for this requester+item so callers can resume it
 * instead of creating a duplicate. Rejected/completed/empty lendingStatus are excluded
 * (a borrower may legitimately re-request; conversations created before the lending
 * feature have no status value). Returns the newest matching conversation id, or null.
 */
export async function findResumableConversation(
	pb: PocketBase,
	requesterId: string,
	itemId: string
): Promise<string | null> {
	try {
		const conversations = await pb.collection('conversations').getFullList({
			filter: pb.filter(
				'requester = {:requesterId} && requestedItem = {:itemId} && ' +
					lendingStatusFilter(OPEN_LENDING_STATES),
				{ requesterId, itemId }
			),
			sort: '-created',
			fields: 'id',
		});
		return conversations[0]?.id ?? null;
	} catch {
		return null;
	}
}

export type StartConversationResult =
	| { status: 'ok'; conversationId: string }
	| { status: 'error'; httpStatus: number; message: string };

/**
 * Creates a new pending conversation for requester+item and notifies the owner
 * (in-app notification + push). Callers run their own gates first (auth, off-platform
 * contact, terms acceptance) and check {@link findResumableConversation} where resuming
 * should win over creating.
 *
 * The backend hook on conversation create is the authoritative gate for the lender's
 * borrower requirements (#423/#389) — we don't re-check here (single source of truth).
 * If the hook rejects with 'lending_requirement_unmet: <keys>', the keys are mapped to
 * friendly labels in the returned error message.
 */
export async function startConversationAndNotify(
	pb: PocketBase,
	requester: { id: string; username?: string; name?: string },
	item: { id: string; ownerId: string; name?: string | null }
): Promise<StartConversationResult> {
	let conversation;
	try {
		conversation = await pb.collection('conversations').create({
			requester: requester.id,
			itemOwner: item.ownerId,
			requestedItem: item.id,
			lendingStatus: 'pending',
			readByRequester: true,
			readByOwner: false,
			lastMessageAt: new Date().toISOString(),
		});
	} catch (err) {
		const e = err as Partial<ClientResponseError> & { response?: { message?: string } };
		const raw = [e.response?.message, e.message].filter(Boolean).join(' ');
		const m = raw.match(/lending_requirement_unmet:\s*([a-z_,]+)/i);
		if (m) {
			const labels = m[1]
				.split(',')
				.map((k) => requirementRegistry.find((d) => d.key === k.trim())?.label)
				.filter(Boolean);
			return {
				status: 'error',
				httpStatus: 403,
				message: labels.length
					? `${texts.lendingRequirements.blockedIntro} ${labels.join(', ')}`
					: texts.lendingRequirements.blockedIntro,
			};
		}
		return {
			status: 'error',
			httpStatus: e.status ?? 500,
			message: e.data?.message ?? texts.errors.failedToCreateConversation,
		};
	}

	const requesterName = requester.username ?? requester.name ?? texts.pages.itemDetail.unknownRequester;
	// items_public masks trustees-only item names; the requester is authorized (the
	// conversation was just created), so read the real name from base items if masked.
	let itemName = item.name;
	if (!itemName) {
		try {
			itemName = (await pb.collection('items').getOne(item.id, { fields: 'name' })).name;
		} catch {
			// fall back to the generic label below
		}
	}
	const notificationBody = texts.notifications.newRequest(
		requesterName,
		itemName ?? texts.pages.itemDetail.unknownItem
	);
	const conversationUrl = `/conversations/${conversation.id}`;

	await createNotification(pb, item.ownerId, requester.id, 'new_request', conversation.id, notificationBody);
	await sendPushToUser(pb, item.ownerId, texts.notifications.pushTitle, notificationBody, conversationUrl);

	return { status: 'ok', conversationId: conversation.id };
}

/**
 * Deletes a conversation and every notification referencing it.
 *
 * Lives here (rather than in the `[conversationId]` route) because `$lib/server/items.ts`
 * needs it too when cascading item deletion to its conversations — libs must never import
 * from routes, so this is the shared home both the route action and `items.ts` call into.
 *
 * Throws on failure — caller is responsible for catching and returning fail().
 */
export async function deleteConversation(pb: PocketBase, conversationId: string): Promise<void> {
	await pb.collection('conversations').delete(conversationId);

	try {
		const orphaned = await pb.collection('notifications').getFullList({
			filter: pb.filter('relatedId={:conversationId}', { conversationId }),
		});
		await Promise.all(orphaned.map((n) => pb.collection('notifications').delete(n.id)));
	} catch (err) {
		console.error('Failed to clean up orphaned notifications for conversation', err);
	}
}
