import type PocketBase from 'pocketbase';
import type { ClientResponseError } from 'pocketbase';
import { fail } from '@sveltejs/kit';
import type { Message } from '$lib/types/models.js';
import { texts } from '$lib/texts';
import { createNotification, sendPushToUser, isMessageNotificationThrottled } from '$lib/server/notifications.js';

/** Convenience alias for the return type of SvelteKit's `fail()`. */
type FailResult = ReturnType<typeof fail>;

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
		createdMessage = await pb.collection('messages').create({ messageContent, from: fromUserId, to: toUserId });
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

// Throws on failure — caller is responsible for catching and returning fail().
export async function deleteConversation(pb: PocketBase, conversationId: string): Promise<void> {
	await pb.collection('conversations').delete(conversationId);

	try {
		const orphaned = await pb.collection('notifications').getFullList({
			filter: `relatedId="${conversationId}"`,
		});
		await Promise.all(orphaned.map((n) => pb.collection('notifications').delete(n.id)));
	} catch (err) {
		console.error('Failed to clean up orphaned notifications for conversation', err);
	}
}
