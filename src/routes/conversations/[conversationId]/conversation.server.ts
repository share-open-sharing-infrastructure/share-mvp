import type PocketBase from 'pocketbase';
import type { ClientResponseError } from 'pocketbase';
import { fail } from '@sveltejs/kit';
import type { Message } from '$lib/types/models.js';
import { texts } from '$lib/texts';
import { notifyAndPush, isMessageNotificationThrottled } from '$lib/server/notifications.js';

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
 * Creates a message and atomically appends it to the conversation's `messages` relation via
 * PocketBase's `'messages+'` append modifier — no read-modify-write, so concurrent sends can
 * no longer race and drop a message (the previous implementation fetched the conversation,
 * spread `.messages`, appended, then wrote the whole array back).
 *
 * `recipientIsRequester` is derived by the caller (which already loaded the conversation to
 * verify the sender is a participant) — never trust a client-supplied recipient identity here.
 */
export async function sendMessage(
	pb: PocketBase,
	conversationId: string,
	messageContent: FormDataEntryValue | null,
	{
		fromUserId,
		toUserId,
		senderName,
		recipientIsRequester,
	}: {
		fromUserId: string;
		toUserId: string;
		senderName: string;
		recipientIsRequester: boolean;
	}
): Promise<FailResult | void> {
	let createdMessage: Message;
	try {
		createdMessage = await pb.collection('messages').create({ messageContent, from: fromUserId, to: toUserId, conversation: conversationId });
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		return fail(e.status ?? 500, { fail: true, message: e.data?.message ?? texts.errors.failedToSendMessage });
	}

	try {
		await pb.collection('conversations').update(conversationId, {
			'messages+': createdMessage.id,
			lastMessageAt: new Date().toISOString(),
			...(recipientIsRequester ? { readByRequester: false } : { readByOwner: false }),
		});
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		return fail(e.status ?? 500, { fail: true, message: e.data?.message ?? texts.errors.failedToSendMessage });
	}

	const notificationBody = texts.notifications.newMessage(senderName);
	const throttled = await isMessageNotificationThrottled(pb, toUserId, conversationId);
	if (!throttled) {
		await notifyAndPush(pb, {
			recipient: toUserId,
			sender: fromUserId,
			type: 'new_message',
			relatedId: conversationId,
			body: notificationBody,
		});
	}
}

/**
 * Marks the conversation as read for the given viewer. Idempotent: only writes the record when
 * the viewer's flag is actually unread, so it is safe to call repeatedly.
 *
 * Triggered exclusively from the `markRead` form action (NOT from load()) so that a mere
 * hover-preload of the route — `data-sveltekit-preload-data="hover"` runs a route's load() on
 * hover — can no longer flip read-state without the thread being opened (issue #412). The page
 * fires it when it mounts and again whenever a realtime update says the viewer went unread
 * while the thread is open (an incoming message flips the recipient's flag — see
 * {@link sendMessage}).
 *
 * Takes the already-fetched conversation record (`id`, participants, read flags) rather than
 * re-fetching, so a real open costs a single `getOne` in the calling action instead of two.
 */
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
