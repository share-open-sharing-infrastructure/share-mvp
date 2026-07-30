import { error, fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import type { Conversation } from '$lib/types/models.js';
import { COUNTERFACTUAL_ANSWERS } from '$lib/types/models.js';
import { texts } from '$lib/texts';
import { displayName } from '$lib/utils/utils';
import { deleteConversation, conversationFieldsWithSafePartners } from '$lib/server/conversations.js';
import { toggleItemStatus } from '$lib/server/items.js';
import * as lending from './lending.server.js';
import { sendMessage, markConversationRead, type ConversationReadState } from './conversation.server.js';
import { toConversationDetail } from './conversationDetail.js';
import { fetchPartnerContact } from '$lib/server/contacts';

/** Cap on a chat message's length (mirrors the backend's max, keeps failures explicit). */
const MAX_MESSAGE_LENGTH = 5000;

/** Cap on the free-text answer for the 'other' counterfactual option. */
const MAX_COUNTERFACTUAL_TEXT_LENGTH = 1000;

/** UI-only sentinel for "I'll type my own answer" — replaced by the free-text field's value. */
const COUNTERFACTUAL_OTHER_SENTINEL = 'other';

export async function load({ params, locals }) {
	const conversationId: string = params.conversationId;
	let conversationRecord: Conversation;
	try {
		conversationRecord = await locals.pb
			.collection('conversations')
			.getOne<Conversation>(conversationId, {
				expand: 'requester, itemOwner, requestedItem, messages',
				// requester/itemOwner are restricted to a safe field subset (never the full
				// User, in particular never `email`) — see conversationFieldsWithSafePartners().
				fields: conversationFieldsWithSafePartners('*,expand.requestedItem.*,expand.messages.*'),
			});
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		error(e.status === 404 ? 404 : 500, e.status === 404 ? texts.errors.conversationNotFound : 'Unable to load conversation.');
	}

	const isParticipant =
		locals.user?.id === conversationRecord.requester ||
		locals.user?.id === conversationRecord.itemOwner;
	if (!isParticipant) error(403, texts.errors.noPermission);

	const conversation = toConversationDetail(conversationRecord);

	// NB: read-state is deliberately NOT mutated here. `app.html` sets
	// data-sveltekit-preload-data="hover", so SvelteKit runs this load() when the user merely
	// hovers a link to the conversation — marking read in load() therefore flipped threads to
	// read on hover, without them ever being opened (issue #412). Read-marking now happens only
	// via the `markRead` action below, fired by the page once it is actually mounted.
	const partnerId =
		conversationRecord.requester === locals.user?.id
			? conversationRecord.itemOwner
			: conversationRecord.requester;
	const partnerContact = await fetchPartnerContact(locals.pb, partnerId);

	return { conversation, partnerContact };
}

export const actions = {
	// Explicitly triggered by the page once it is actually opened (see +page.svelte), so
	// read-state is no longer flipped by a hover-preload of load() (issue #412). The page also
	// re-fires it when a realtime update says the viewer went unread while the thread is open.
	// Participation is authorised server-side here — the client is not trusted.
	markRead: async ({ locals, params }) => {
		if (!locals.user) return fail(401, { fail: true, message: texts.errors.noPermission });
		const userId = locals.user.id;

		// Single getOne that both authorises participation and provides the read flags, so
		// markConversationRead does not have to re-fetch the record.
		let conversation: ConversationReadState;
		try {
			conversation = await locals.pb
				.collection('conversations')
				.getOne<ConversationReadState>(params.conversationId, {
					fields: 'id,requester,itemOwner,readByRequester,readByOwner',
				});
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.lending.errors.notFound });
		}
		if (conversation.requester !== userId && conversation.itemOwner !== userId) {
			return fail(403, { fail: true, message: texts.errors.noPermission });
		}

		try {
			await markConversationRead(locals.pb, conversation, userId);
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
		}
	},

	sendMessage: async ({ locals, request, params }) => {
		const data = await request.formData();
		const content = data.get('messageContent')?.toString().trim();
		if (!content) return fail(400, { fail: true, message: texts.errors.somethingWentWrong });
		if (content.length > MAX_MESSAGE_LENGTH) return fail(400, { fail: true, message: texts.errors.somethingWentWrong });

		// The recipient must be derived server-side from the conversation's actual
		// participants — never trust a client-supplied identity here (a hidden
		// `chatPartnerId` field used to let any participant spoof an arbitrary
		// recipient for messaging/push-notification purposes).
		let conversation: Pick<Conversation, 'requester' | 'itemOwner'>;
		try {
			conversation = await locals.pb
				.collection('conversations')
				.getOne(params.conversationId, { fields: 'requester,itemOwner' });
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.lending.errors.notFound });
		}
		const isRequester = conversation.requester === locals.user.id;
		const isOwner = conversation.itemOwner === locals.user.id;
		if (!isRequester && !isOwner) return fail(403, { fail: true, message: texts.errors.noPermission });

		const recipientId = isRequester ? conversation.itemOwner : conversation.requester;
		const senderName = displayName(locals.user);
		return sendMessage(locals.pb, params.conversationId, content, {
			fromUserId: locals.user.id,
			toUserId: recipientId,
			senderName,
			recipientIsRequester: isOwner,
		});
	},

	toggleStatus: async ({ locals, params }) => {
		// Derived from the conversation's own item relation — never trusts a client-supplied
		// itemId (a hidden form field used to let a caller target an arbitrary item).
		let conversation: Pick<Conversation, 'requestedItem'>;
		try {
			conversation = await locals.pb
				.collection('conversations')
				.getOne(params.conversationId, { fields: 'requestedItem' });
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.lending.errors.notFound });
		}

		try {
			const result = await toggleItemStatus(locals.pb, conversation.requestedItem, locals.user.id);
			if (result.status === 'not_found') return fail(404, { fail: true, message: texts.errors.itemNotFound });
			if (result.status === 'not_owner') return fail(403, { fail: true, message: texts.errors.noPermission });
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
		}
	},

	deleteConversation: async ({ locals, params }) => {
		try {
			const conv = await locals.pb
				.collection('conversations')
				.getOne(params.conversationId, { fields: 'requester,itemOwner' });
			if (conv.requester !== locals.user.id && conv.itemOwner !== locals.user.id) {
				return fail(403, { fail: true, message: texts.errors.noPermission });
			}
			await deleteConversation(locals.pb, params.conversationId);
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: e.data?.message ?? texts.errors.failedToDeleteConversation });
		}
		redirect(303, '/conversations');
	},

	acceptRequest: async ({ locals, params }) => {
		return lending.acceptRequest(locals.pb, params.conversationId, locals.user.id);
	},

	rejectRequest: async ({ locals, params }) => {
		return lending.rejectRequest(locals.pb, params.conversationId, locals.user.id);
	},

	abortRequest: async ({ locals, params }) => {
		return lending.abortRequest(locals.pb, params.conversationId, locals.user.id);
	},

	confirmHandover: async ({ locals, params }) => {
		return lending.confirmHandover(locals.pb, params.conversationId, locals.user.id);
	},

	requestReturn: async ({ locals, params }) => {
		const requesterName = locals.user.username ?? texts.pages.itemDetail.unknownRequester;
		return lending.requestReturn(locals.pb, params.conversationId, locals.user.id, requesterName);
	},

	confirmReturn: async ({ locals, params }) => {
		return lending.confirmReturn(locals.pb, params.conversationId, locals.user.id);
	},

	submitCounterfactual: async ({ locals, request, params }) => {
		const form = await request.formData();
		let answer = form.get('answer') as string;
		// 'other' is a UI-only sentinel replaced by free text below; all other values must be
		// one of the valid submittable COUNTERFACTUAL_ANSWERS ('pending' is server-assigned,
		// never a submittable answer, and therefore correctly excluded from that list).
		const validSentinelsOrAnswers: readonly string[] = [...COUNTERFACTUAL_ANSWERS, COUNTERFACTUAL_OTHER_SENTINEL];
		if (!validSentinelsOrAnswers.includes(answer)) return fail(400, { fail: true, message: texts.errors.somethingWentWrong });
		if (answer === COUNTERFACTUAL_OTHER_SENTINEL) {
			const text = (form.get('answerText') as string)?.trim();
			if (!text) return fail(400, { fail: true, message: texts.errors.somethingWentWrong });
			if (text.length > MAX_COUNTERFACTUAL_TEXT_LENGTH) return fail(400, { fail: true, message: texts.errors.somethingWentWrong });
			answer = text;
		}
		try {
			const conv = await locals.pb
				.collection('conversations')
				.getOne(params.conversationId, { fields: 'requester,counterfactual' });
			// Only the original requester answers the research question (an owner is not who
			// the question is about), and only once — overwriting an already-submitted answer
			// is not allowed.
			if (conv.requester !== locals.user.id) {
				return fail(403, { fail: true, message: texts.errors.noPermission });
			}
			if (conv.counterfactual !== 'pending') {
				return fail(400, { fail: true, message: texts.errors.somethingWentWrong });
			}
			await locals.pb.collection('conversations').update(params.conversationId, { counterfactual: answer });
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
		}
	},
};
