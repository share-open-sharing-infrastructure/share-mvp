import type PocketBase from 'pocketbase';
import type { ClientResponseError } from 'pocketbase';
import { fail } from '@sveltejs/kit';
import type { NotificationType } from '$lib/types/models.js';
import { texts } from '$lib/texts';
import { createNotification, sendPushToUser } from '$lib/server/notifications.js';

const PERCENTAGE_OF_USERS_ASKED = 0.33;

export function shouldAskCounterfactual(rng: () => number = Math.random): boolean {
	return rng() < PERCENTAGE_OF_USERS_ASKED;
}

/** Convenience alias for the return type of SvelteKit's `fail()`. */
type FailResult = ReturnType<typeof fail>;

/**
 * Loads a conversation and guards against the two most common action errors:
 * wrong caller role (403) and wrong lending state (400).
 *
 * Returns `{ conv }` on success or `{ error }` with a ready-to-return `fail()` value.
 * `conv` is a raw PocketBase record — fields are accessed by string key because
 * PocketBase's SDK returns untyped plain objects.
 */
async function loadAndValidateConversation(
	pb: PocketBase,
	conversationId: string,
	userId: string,
	requiredRole: 'owner' | 'requester',
	requiredStatus: string | string[]
): Promise<{ conv: Record<string, unknown> } | { error: FailResult }> {
	let conversation: Record<string, unknown>;
	try {
		conversation = await pb.collection('conversations').getOne(conversationId);
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		return { error: fail(e.status ?? 500, { fail: true, message: texts.lending.errors.notFound }) };
	}
	const roleField = requiredRole === 'owner' ? 'itemOwner' : 'requester';
	if (conversation[roleField] !== userId) return { error: fail(403, { fail: true, message: texts.lending.errors.noPermission }) };
	const validStatuses = Array.isArray(requiredStatus) ? requiredStatus : [requiredStatus];
	if (!validStatuses.includes(conversation.lendingStatus as string)) return { error: fail(400, { fail: true, message: texts.lending.errors.invalidState }) };
	return { conv: conversation };
}

/** Sends both an in-app notification and a push to all of a user's registered devices. */
async function notifyUser(
	pb: PocketBase,
	recipientId: string,
	senderId: string,
	type: NotificationType,
	conversationId: string,
	body: string
): Promise<void> {
	const url = `/conversations/${conversationId}`;
	await createNotification(pb, recipientId, senderId, type, conversationId, body);
	await sendPushToUser(pb, recipientId, texts.notifications.pushTitle, body, url);
}

/** Fetches an item's display name, falling back gracefully if the item can't be loaded. */
async function getItemName(pb: PocketBase, itemId: string): Promise<string> {
	try {
		const item = await pb.collection('items').getOne(itemId);
		return item.name ?? texts.pages.itemDetail.unknownItem;
	} catch {
		return texts.pages.itemDetail.unknownItem;
	}
}

/**
 * State transition: `pending` → `accepted` (called by item owner).
 * Marks the item unavailable and auto-rejects all other pending conversations
 * for the same item so only one borrower can proceed.
 */
export async function acceptRequest(
	pb: PocketBase,
	conversationId: string,
	userId: string
): Promise<FailResult | void> {
	const result = await loadAndValidateConversation(pb, conversationId, userId, 'owner', 'pending');
	if ('error' in result) return result.error;
	const { conv } = result;

	const itemName = await getItemName(pb, conv.requestedItem as string);

	try {
		await pb.collection('conversations').update(conversationId, { lendingStatus: 'accepted' });
		await pb.collection('items').update(conv.requestedItem as string, { status: 'unavailable' });
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
	}

	await notifyUser(pb, conv.requester as string, userId, 'request_accepted', conversationId, texts.notifications.requestAccepted(itemName));

	// Auto-reject all other pending conversations for the same item
	try {
		const otherPending = await pb.collection('conversations').getFullList({
			filter: pb.filter('requestedItem={:requestedItem} && lendingStatus="pending" && id!={:conversationId}', {
				requestedItem: conv.requestedItem,
				conversationId,
			}),
		});
		await Promise.all(otherPending.map(async (other) => {
			await pb.collection('conversations').update(other.id, { lendingStatus: 'rejected' });
			await notifyUser(pb, other.requester, userId, 'request_rejected', other.id, texts.notifications.requestRejected(itemName));
		}));
	} catch (err) {
		console.error('Failed to auto-reject other pending conversations:', err);
	}
}

/** State transition: `pending` → `rejected` (called by item owner). */
export async function rejectRequest(
	pb: PocketBase,
	conversationId: string,
	userId: string
): Promise<FailResult | void> {
	const result = await loadAndValidateConversation(pb, conversationId, userId, 'owner', 'pending');
	if ('error' in result) return result.error;
	const { conv } = result;

	try {
		await pb.collection('conversations').update(conversationId, { lendingStatus: 'rejected' });
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
	}

	const itemName = await getItemName(pb, conv.requestedItem as string);
	await notifyUser(pb, conv.requester as string, userId, 'request_rejected', conversationId, texts.notifications.requestRejected(itemName));
}

/** State transition: `accepted` → `active` (called by item owner after physical handover). */
export async function confirmHandover(
	pb: PocketBase,
	conversationId: string,
	userId: string
): Promise<FailResult | void> {
	const result = await loadAndValidateConversation(pb, conversationId, userId, 'owner', 'accepted');
	if ('error' in result) return result.error;
	const { conv } = result;

	try {
		await pb.collection('conversations').update(conversationId, { lendingStatus: 'active' });
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
	}

	const itemName = await getItemName(pb, conv.requestedItem as string);
	await notifyUser(pb, conv.requester as string, userId, 'handover_confirmed', conversationId, texts.notifications.handoverConfirmed(itemName));
}

/** State transition: `active` → `return_requested` (called by the borrower). */
export async function requestReturn(
	pb: PocketBase,
	conversationId: string,
	userId: string,
	requesterName: string
): Promise<FailResult | void> {
	const result = await loadAndValidateConversation(pb, conversationId, userId, 'requester', 'active');
	if ('error' in result) return result.error;
	const { conv } = result;

	try {
		await pb.collection('conversations').update(conversationId, { lendingStatus: 'return_requested' });
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
	}

	const itemName = await getItemName(pb, conv.requestedItem as string);
	await notifyUser(pb, conv.itemOwner as string, userId, 'return_requested', conversationId, texts.notifications.returnRequested(requesterName, itemName));
}

/**
 * State transition: `active` | `return_requested` → `completed` (called by item owner).
 * Marks the item available again so it can receive new requests.
 */
export async function confirmReturn(
	pb: PocketBase,
	conversationId: string,
	userId: string
): Promise<FailResult | void> {
	const result = await loadAndValidateConversation(pb, conversationId, userId, 'owner', ['active', 'return_requested']);
	if ('error' in result) return result.error;
	const { conv } = result;

	const itemName = await getItemName(pb, conv.requestedItem as string);

	try {
		const counterfactualPatch = shouldAskCounterfactual() ? { counterfactual: 'pending' } : {};
		await pb.collection('conversations').update(conversationId, { lendingStatus: 'completed', ...counterfactualPatch });
		await pb.collection('items').update(conv.requestedItem as string, { status: 'available' });
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
	}

	await notifyUser(pb, conv.requester as string, userId, 'return_confirmed', conversationId, texts.notifications.returnConfirmed(itemName));
}
