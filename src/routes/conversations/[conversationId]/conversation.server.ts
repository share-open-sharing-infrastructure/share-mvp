import type PocketBase from 'pocketbase';
import type { ClientResponseError, RecordModel } from 'pocketbase';
import { fail } from '@sveltejs/kit';
import type { Message } from '$lib/types/models.js';
import { texts } from '$lib/texts';
import { createNotification, sendPushToUser, isMessageNotificationThrottled } from '$lib/server/notifications.js';

/** Convenience alias for the return type of SvelteKit's `fail()`. */
type FailResult = ReturnType<typeof fail>;

/** The conversation fields {@link markConversationRead} needs — a subset of the record. */
export interface ConversationReadState {
	id: string;
	requester: string;
	itemOwner: string;
	readByRequester: boolean;
	readByOwner: boolean;
}

/**
 * Thrown by {@link fetchConversationForParticipant} when the given user is neither the
 * requester nor the itemOwner of the conversation. Callers translate it to `fail(403, …)`.
 */
export class NotParticipantError extends Error {
	constructor() {
		super('User is not a participant of this conversation');
		this.name = 'NotParticipantError';
	}
}

/**
 * Translates an error caught in a conversation form action into a `fail()` result:
 * a {@link NotParticipantError} becomes `fail(403, …)` with the no-permission message;
 * any other error becomes `fail(<PocketBase status> ?? 500, …)` with the caller-supplied
 * `fallbackMessage`. Callers pass their own fallback (which may itself resolve a
 * server-provided `e.data?.message`), keeping each action's existing message semantics.
 */
export function toActionFailResult(err: unknown, fallbackMessage: string): FailResult {
	if (err instanceof NotParticipantError) {
		return fail(403, { fail: true, message: texts.errors.noPermission });
	}
	const e = err as Partial<ClientResponseError>;
	return fail(e.status ?? 500, { fail: true, message: fallbackMessage });
}

/**
 * Fetches a conversation once and asserts the given user is a participant (requester or
 * itemOwner). `id,requester,itemOwner` are always fetched; pass `extraFields` (a comma-separated
 * field list) for anything the caller additionally needs, so the record is read in a single
 * `getOne`. Throws {@link NotParticipantError} when the user is not a participant; any other
 * error (e.g. a 404 from PocketBase) propagates for the caller to translate.
 */
export async function fetchConversationForParticipant(
	pb: PocketBase,
	conversationId: string,
	userId: string | undefined,
	extraFields?: string
): Promise<RecordModel> {
	const fields = extraFields ? `id,requester,itemOwner,${extraFields}` : 'id,requester,itemOwner';
	const conv = await pb.collection('conversations').getOne(conversationId, { fields });
	if (conv.requester !== userId && conv.itemOwner !== userId) {
		throw new NotParticipantError();
	}
	return conv;
}

export async function sendMessage(
	pb: PocketBase,
	conversationId: string,
	messageContent: FormDataEntryValue | null,
	fromUserId: string,
	toUserId: string,
	senderName: string
): Promise<FailResult | void> {
	let createdMessage: Message;
	try {
		createdMessage = await pb.collection('messages').create({ messageContent, from: fromUserId, to: toUserId, conversation: conversationId });
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		return fail(e.status ?? 500, { fail: true, message: e.data?.message ?? texts.errors.failedToSendMessage });
	}

	// Re-fetch the conversation to read the current messages array before appending.
	// PocketBase's create() response doesn't include parent collection data.
	const conversationRecord = await pb
		.collection('conversations')
		.getOne(conversationId, { expand: 'requester,itemOwner,requestedItem' });

	const updatedMessages = conversationRecord.messages
		? [...conversationRecord.messages, createdMessage.id]
		: [createdMessage.id];

	const recipientIsRequester = conversationRecord.requester === toUserId;
	try {
		await pb.collection('conversations').update(conversationId, {
			messages: updatedMessages,
			lastMessageAt: new Date().toISOString(),
			...(recipientIsRequester ? { readByRequester: false } : { readByOwner: false }),
		});
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		return fail(e.status ?? 500, { fail: true, message: e.data?.message ?? texts.errors.failedToSendMessage });
	}

	const notificationBody = texts.notifications.newMessage(senderName);
	const conversationUrl = `/conversations/${conversationId}`;
	const throttled = await isMessageNotificationThrottled(pb, toUserId, conversationId);
	if (!throttled) {
		await createNotification(pb, toUserId, fromUserId, 'new_message', conversationId, notificationBody);
		await sendPushToUser(pb, toUserId, texts.notifications.pushTitle, notificationBody, conversationUrl);
	}
}

export async function toggleItemStatus(
	pb: PocketBase,
	itemId: string,
	userId: string
): Promise<FailResult | void> {
	if (!itemId) return fail(400, { fail: true, message: 'Fehlende Item-ID.' });

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let item: any;
	try {
		item = await pb.collection('items').getOne(itemId);
	} catch {
		return fail(404, { fail: true, message: texts.errors.itemNotFound });
	}

	if (item.owner !== userId) return fail(403, { fail: true, message: texts.errors.noPermission });

	const newStatus = item.status === 'available' ? 'unavailable' : 'available';
	try {
		await pb.collection('items').update(itemId, { status: newStatus });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (err: Error | any) {
		console.error(err?.message ?? err);
	}
}

// Marks the conversation as read for the given viewer. Idempotent: only writes when
// something is actually unread, so it is safe to call on every real open of the thread.
// Triggered explicitly from the `markRead` form action (NOT from load()) so that a mere
// hover-preload of the route — data-sveltekit-preload-data="hover" — can no longer flip
// read-state without the thread being opened (issue #412).
//
// Takes the already-fetched conversation record (with `id` + the read flags) rather than
// re-fetching, so a real open costs a single `getOne` (done by the caller via
// {@link fetchConversationForParticipant}) instead of two.
export async function markConversationRead(
	pb: PocketBase,
	conversation: ConversationReadState,
	userId: string
): Promise<void> {
	const conversationId = conversation.id;
	const isRequester = conversation.requester === userId;
	const isOwner = conversation.itemOwner === userId;
	const needsUpdate =
		(isRequester && !conversation.readByRequester) ||
		(isOwner && !conversation.readByOwner);

	if (needsUpdate) {
		await pb.collection('conversations').update(conversationId, {
			...(isRequester && { readByRequester: true }),
			...(isOwner && { readByOwner: true }),
		});
	}

	// Conversation read state (readByRequester/readByOwner) and notification read
	// state are tracked in separate collections, so viewing the conversation does
	// not automatically clear the notification badge. We sync them here.
	const unreadNotifs = await pb.collection('notifications').getFullList({
		filter: pb.filter('recipient={:userId} && relatedId={:conversationId} && read=false', {
			userId,
			conversationId,
		}),
		fields: 'id',
	});
	if (unreadNotifs.length > 0) {
		await Promise.all(
			unreadNotifs.map((n) =>
				pb.collection('notifications').update(n.id, { read: true }).catch(() => {})
			)
		);
	}
}

// Throws on failure — caller is responsible for catching and returning fail().
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
