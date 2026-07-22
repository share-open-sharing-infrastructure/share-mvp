import { error, fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { PUBLIC_PB_URL } from '$env/static/public';
import type { Conversation, CounterfactualAnswer } from '$lib/types/models.js';
import { texts } from '$lib/texts';
import * as lending from './lending.server.js';
import * as messaging from './conversation.server.js';
import { fetchPartnerContact } from '$lib/server/contacts';

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

	const isParticipant =
		locals.user?.id === conversationRecord.requester ||
		locals.user?.id === conversationRecord.itemOwner;
	if (!isParticipant) error(403, texts.errors.noPermission);

	const conversation: Conversation = {
		id: conversationRecord.id,
		requester: conversationRecord.expand?.requester,
		itemOwner: conversationRecord.expand?.itemOwner,
		requestedItem: conversationRecord.expand?.requestedItem,
		messages: conversationRecord.expand?.messages,
		readByRequester: conversationRecord.readByRequester,
		readByOwner: conversationRecord.readByOwner,
		lendingStatus: conversationRecord.lendingStatus ?? undefined,
		counterfactual: conversationRecord.counterfactual ?? undefined,
		created: conversationRecord.created,
		updated: conversationRecord.updated,
	};

	// NB: read-state is deliberately NOT mutated here. load() runs on hover-preload
	// (data-sveltekit-preload-data="hover"), so marking read in load() flipped threads
	// to read on mere hover. Marking read now happens only via the `markRead` action,
	// fired from the page once it is actually opened (issue #412).
	const partnerId =
		conversationRecord.requester === locals.user?.id
			? conversationRecord.itemOwner
			: conversationRecord.requester;
	const partnerContact = await fetchPartnerContact(locals.pb, partnerId);

	return { conversation, PB_URL: PUBLIC_PB_URL, partnerContact };
}

export const actions = {
	// Explicitly triggered when the conversation page is actually opened (see +page.svelte),
	// so read-state is no longer flipped by a hover-preload of load() (issue #412).
	markRead: async ({ locals, params }) => {
		if (!locals.user) return fail(401, { fail: true, message: texts.errors.noPermission });
		const conversationId = params.conversationId;
		try {
			// Single getOne (fetches the read flags too) that also authorises participation;
			// the read state is handed to markConversationRead so it does not re-fetch.
			const conv = await messaging.fetchConversationForParticipant(
				locals.pb,
				conversationId,
				locals.user.id,
				'readByRequester,readByOwner'
			);
			await messaging.markConversationRead(
				locals.pb,
				{
					id: conv.id,
					requester: conv.requester,
					itemOwner: conv.itemOwner,
					readByRequester: conv.readByRequester,
					readByOwner: conv.readByOwner,
				},
				locals.user.id
			);
		} catch (err) {
			return messaging.toActionFailResult(err, texts.errors.somethingWentWrong);
		}
	},

	sendMessage: async ({ locals, request, params }) => {
		const data = await request.formData();
		const content = data.get('messageContent')?.toString().trim();
		if (!content) return fail(400, { fail: true, message: texts.errors.somethingWentWrong });
		if (content.length > 5000) return fail(400, { fail: true, message: texts.errors.somethingWentWrong });
		const senderName = locals.user.username ?? locals.user.name ?? 'Jemand';
		return messaging.sendMessage(
			locals.pb,
			params.conversationId,
			content,
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
			await messaging.fetchConversationForParticipant(locals.pb, conversationId, locals.user?.id);
			await messaging.deleteConversation(locals.pb, conversationId);
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return messaging.toActionFailResult(err, e.data?.message ?? texts.errors.failedToDeleteConversation);
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

	abortRequest: async ({ locals, params }) => {
		if (!locals.user) return fail(401, { fail: true, message: texts.lending.errors.noPermission });
		return lending.abortRequest(locals.pb, params.conversationId, locals.user.id);
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

	submitCounterfactual: async ({ locals, request }) => {
		const form = await request.formData();
		const conversationId = form.get('conversationId') as string;
		let answer = form.get('answer') as string;
		// 'other' is a UI-only sentinel replaced by free text below; all other values must be valid CounterfactualAnswer values (excluding 'pending' which is server-assigned).
		const valid: (CounterfactualAnswer | 'other')[] = ['would_buy', 'not_important', 'too_expensive', 'borrow_elsewhere', 'unsure', 'other', 'skipped'];
		if (!valid.includes(answer as CounterfactualAnswer | 'other')) return fail(400, { fail: true, message: texts.errors.somethingWentWrong });
		if (answer === 'other') {
			const text = (form.get('answerText') as string)?.trim();
			if (!text) return fail(400, { fail: true, message: texts.errors.somethingWentWrong });
			answer = text;
		}
		try {
			await messaging.fetchConversationForParticipant(locals.pb, conversationId, locals.user?.id);
			await locals.pb.collection('conversations').update(conversationId, { counterfactual: answer });
		} catch (err) {
			return messaging.toActionFailResult(err, texts.errors.somethingWentWrong);
		}
	},
};
