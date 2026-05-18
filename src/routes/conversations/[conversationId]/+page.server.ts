import { error, fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { PUBLIC_PB_URL } from '$env/static/public';
import type { Conversation } from '$lib/types/models.js';
import { texts } from '$lib/texts';
import * as lending from './lending.server.js';
import * as messaging from './conversation.server.js';

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
		lendingStatus: conversationRecord.lendingStatus ?? undefined,
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

	return { conversation, PB_URL: PUBLIC_PB_URL };
}

export const actions = {
	sendMessage: async ({ locals, request, params }) => {
		const data = await request.formData();
		const senderName = locals.user.username ?? locals.user.name ?? 'Jemand';
		return messaging.sendMessage(
			locals.pb,
			params.conversationId,
			data.get('messageContent'),
			locals.user.id,
			data.get('chatPartnerId') as string,
			senderName
		);
	},

	toggleStatus: async ({ locals, request }) => {
		const data = await request.formData();
		return messaging.toggleItemStatus(locals.pb, data.get('itemId')?.toString() ?? '', locals.user.id);
	},

	deleteConversation: async ({ locals, request }) => {
		const data = await request.formData();
		const conversationId = data.get('conversationId') as string;
		try {
			await messaging.deleteConversation(locals.pb, conversationId);
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: e.data?.message ?? texts.errors.failedToDeleteConversation });
		}
		redirect(303, '/conversations');
	},

	acceptRequest: async ({ locals, params }) => {
		if (!locals.user) return fail(401, { fail: true, message: texts.lending.errors.noPermission });
		return lending.acceptRequest(locals.pb, params.conversationId, locals.user.id);
	},

	rejectRequest: async ({ locals, params }) => {
		if (!locals.user) return fail(401, { fail: true, message: texts.lending.errors.noPermission });
		return lending.rejectRequest(locals.pb, params.conversationId, locals.user.id);
	},

	confirmHandover: async ({ locals, params }) => {
		if (!locals.user) return fail(401, { fail: true, message: texts.lending.errors.noPermission });
		return lending.confirmHandover(locals.pb, params.conversationId, locals.user.id);
	},

	requestReturn: async ({ locals, params }) => {
		if (!locals.user) return fail(401, { fail: true, message: texts.lending.errors.noPermission });
		const requesterName = locals.user.username ?? texts.pages.itemDetail.unknownRequester;
		return lending.requestReturn(locals.pb, params.conversationId, locals.user.id, requesterName);
	},

	confirmReturn: async ({ locals, params }) => {
		if (!locals.user) return fail(401, { fail: true, message: texts.lending.errors.noPermission });
		return lending.confirmReturn(locals.pb, params.conversationId, locals.user.id);
	},
};
