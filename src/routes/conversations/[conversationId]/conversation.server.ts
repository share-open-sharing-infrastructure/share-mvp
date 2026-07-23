import type PocketBase from 'pocketbase';
import type { ClientResponseError } from 'pocketbase';
import { fail } from '@sveltejs/kit';
import type { Message } from '$lib/types/models.js';
import { texts } from '$lib/texts';
import { notifyAndPush, isMessageNotificationThrottled } from '$lib/server/notifications.js';

/** Convenience alias for the return type of SvelteKit's `fail()`. */
type FailResult = ReturnType<typeof fail>;

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
