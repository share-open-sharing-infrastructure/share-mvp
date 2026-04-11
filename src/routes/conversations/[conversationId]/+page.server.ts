import { error, fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { PUBLIC_PB_URL } from '$env/static/public';
import type { Conversation, Message } from '$lib/types/models.js';
import { texts } from '$lib/texts';
import { createNotification, sendPushToUser } from '$lib/server/notifications.js';

export async function load({ params, locals }) {
	const conversationId: string = params.conversationId;
	let conversationRecord;
	try {
		conversationRecord = await locals.pb
			.collection('conversations')
			.getOne(conversationId, {
				expand: 'requester, itemOwner, requestedItem, messages',
			});
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		error(e.status === 404 ? 404 : 500, e.status === 404 ? texts.errors.conversationNotFound : 'Unable to load conversation.');
	}

	const conversation: Conversation = {
		id: conversationRecord.id,
		requester: conversationRecord.expand?.requester,
		itemOwner: conversationRecord.expand?.itemOwner,
		requestedItem: conversationRecord.expand?.requestedItem,
		messages: conversationRecord.expand?.messages,
		readByRequester: conversationRecord.readByRequester,
		readByOwner: conversationRecord.readByOwner,
		created: conversationRecord.created,
		updated: conversationRecord.updated,
	};

	// Mark the conversation as read for the current viewer
	if (locals.user) {
		const isRequester = conversationRecord.requester === locals.user.id;
		const isOwner = conversationRecord.itemOwner === locals.user.id;
		const needsUpdate =
			(isRequester && !conversationRecord.readByRequester) ||
			(isOwner && !conversationRecord.readByOwner);

		if (needsUpdate) {
			await locals.pb.collection('conversations').update(conversationId, {
				...(isRequester && { readByRequester: true }),
				...(isOwner && { readByOwner: true }),
			});
		}
	}

	return {
		conversation,
		PB_URL: PUBLIC_PB_URL,
	};
}

export const actions = {
	sendMessage: async ({ locals, request, params }) => {
		const formData = await request.formData();

		const messageContent = formData.get('messageContent');
		const fromUserId = locals.user.id;
		const toUserId = formData.get('chatPartnerId') as string;

		const messageData = {
			messageContent: messageContent,
			from: fromUserId,
			to: toUserId,
		};

		let createdMessage: Message;
		// try to send message to database
		try {
			createdMessage = await locals.pb
				.collection('messages')
				.create(messageData);
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, {
				fail: true,
				message: e.data?.message ?? texts.errors.failedToSendMessage,
			});
		}

		// Append created message to conversation and update unread status for recipient
		if (createdMessage) {
			const conversationId: string = params.conversationId;
			const conversationRecord = await locals.pb
				.collection('conversations')
				.getOne(conversationId, { expand: 'requester,itemOwner,requestedItem' });
			const updatedMessages = conversationRecord.messages
				? [...conversationRecord.messages, createdMessage.id]
				: [createdMessage.id];

			// Mark conversation as unread for the recipient
			const recipientIsRequester = conversationRecord.requester === toUserId;
			try {
				await locals.pb
					.collection('conversations')
					.update(conversationId, {
						messages: updatedMessages,
						...(recipientIsRequester
							? { readByRequester: false }
							: { readByOwner: false }),
					});
			} catch (err) {
				const e = err as Partial<ClientResponseError>;
				return fail(e.status ?? 500, {
					fail: true,
					message: e.data?.message ?? texts.errors.failedToSendMessage,
				});
			}

			// Create in-app notification and send push for the recipient
			const senderName = locals.user.username ?? locals.user.name ?? 'Jemand';
			const notificationBody = texts.notifications.newMessage(senderName);
			const conversationUrl = `/conversations/${conversationId}`;

			await createNotification(locals.pb, toUserId, locals.user.id, 'new_message', conversationId, notificationBody);
			await sendPushToUser(locals.pb, toUserId, texts.notifications.pushTitle, notificationBody, conversationUrl);
		}
	},
	toggleStatus: async ({ locals, request }) => {
		const formData = await request.formData();
		const itemId = formData.get('itemId')?.toString();
		if (!itemId) return fail(400, { fail: true, message: 'Fehlende Item-ID.' });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let item: any;
		try {
			item = await locals.pb.collection('items').getOne(itemId);
		} catch {
			return fail(404, { fail: true, message: 'Gegenstand nicht gefunden.' });
		}

		if (item.owner !== locals.user.id) return fail(403, { fail: true, message: 'Keine Berechtigung.' });

		const newStatus = item.status === 'available' ? 'unavailable' : 'available';
		try {
			await locals.pb.collection('items').update(itemId, { status: newStatus });
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: Error | any) {
			console.error(err?.message ?? err);
		}
	},

	deleteConversation: async ({ locals, request }) => {
		const formData = await request.formData();
		const conversationId = formData.get('conversationId') as string;

		try {
			await locals.pb.collection('conversations').delete(conversationId);
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, {
				fail: true,
				message: e.data?.message ?? texts.errors.failedToDeleteConversation,
			});
		}

		// Clean up notifications pointing to this conversation
		try {
			const orphaned = await locals.pb.collection('notifications').getFullList({
				filter: `relatedId="${conversationId}"`,
			});
			await Promise.all(orphaned.map((n) => locals.pb.collection('notifications').delete(n.id)));
		} catch (err) {
			console.error('Failed to clean up orphaned notifications for conversation', err);
		}

		redirect(303, '/conversations');
	},
};
