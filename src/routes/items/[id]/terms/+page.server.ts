import { error, fail, redirect } from '@sveltejs/kit';
import type { Item, LendingTerms } from '$lib/types/models';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import {
	getActiveTerms,
	getAcceptance,
	cleanTermsHtml,
} from '$lib/server/lendingTerms';
import {
	findResumableConversation,
	startConversationAndNotify,
} from '$lib/server/conversations';

export async function load({ params, locals, url }) {
	// Auth is required to accept terms. Bounce through login if needed.
	if (!locals.user) {
		redirect(303, `/auth/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	}

	let item: Item;
	try {
		item = await locals.pb.collection('items').getOne(params.id, {
			expand: 'owner',
		});
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		error(e.status === 404 ? 404 : 500, texts.errors.itemNotFound);
	}

	const ownerId = item.expand?.owner?.id ?? item.owner;
	const ownerName = item.expand?.owner?.username ?? '';

	const activeTerms = await getActiveTerms(locals.pb, ownerId);
	if (!activeTerms) {
		// Owner has no active terms → no gating, send user back to item.
		redirect(303, `/items/${params.id}`);
	}

	const existingAcceptance = await getAcceptance(locals.pb, locals.user.id, activeTerms.id);

	// Strip sensitive fields from owner expand before returning.
	if (item.expand?.owner) {
		delete item.expand.owner.geolocation;
		delete item.expand.owner.email;
	}

	// Normalise the richtext body once on the server so display and snapshot stay in sync.
	const cleanedTerms: LendingTerms = {
		...(activeTerms as LendingTerms),
		body: cleanTermsHtml(activeTerms.body),
	};

	return {
		item,
		ownerName,
		terms: cleanedTerms,
		alreadyAccepted: !!existingAcceptance,
	};
}

export const actions = {
	accept: async ({ locals, request, params, getClientAddress }) => {
		if (!locals.user) {
			redirect(303, `/auth/login?redirectTo=/items/${params.id}/terms`);
		}

		// Re-fetch the item so we trust nothing from form data.
		let itemRecord: Item;
		try {
			itemRecord = await locals.pb.collection('items').getOne(params.id);
		} catch {
			return fail(404, { error: true, message: texts.errors.itemNotFound });
		}

		const ownerId = itemRecord.owner;

		// Re-fetch the active terms — never trust an id sent from the client.
		const activeTerms = await getActiveTerms(locals.pb, ownerId);
		if (!activeTerms) {
			return fail(404, { error: true, message: texts.lendingTerms.errors.notFound });
		}

		const formData = await request.formData();
		const confirmAdult = formData.get('confirmAdult') === 'on';
		const confirmTerms = formData.get('confirmTerms') === 'on';

		if (!confirmAdult) {
			return fail(400, { error: true, message: texts.lendingTerms.errors.mustConfirmAdult });
		}
		if (!confirmTerms) {
			return fail(400, { error: true, message: texts.lendingTerms.errors.mustConfirmTerms });
		}

		// Idempotency: skip insert if the user has already accepted this exact version.
		const existing = await getAcceptance(locals.pb, locals.user.id, activeTerms.id);
		if (!existing) {
			let userIp = '';
			try {
				userIp = getClientAddress();
			} catch {
				// SvelteKit throws if no adapter provides it — non-critical.
			}
			const userAgent = request.headers.get('user-agent') ?? '';

			try {
				await locals.pb.collection('term_acceptances').create({
					user: locals.user.id,
					terms: activeTerms.id,
					acceptedAt: new Date().toISOString(),
					confirmedAdult: true,
					fullNameSnapshot: (locals.user.username as string) ?? '',
					// Snapshot the cleaned HTML — same thing the user actually saw.
					termsBody: cleanTermsHtml(activeTerms.body),
					termsVersion: activeTerms.version,
					termsTitle: activeTerms.title,
					userIp,
					userAgent,
				});
			} catch (err) {
				const e = err as Partial<ClientResponseError>;
				console.error('term_acceptance create failed:', e?.message ?? err);
				return fail(500, {
					error: true,
					message: texts.lendingTerms.errors.acceptanceFailed,
				});
			}
		}

		// After acceptance, transparently kick off the actual lending request flow —
		// resume an open conversation if one exists, otherwise create + notify.
		// Shared with /items/[id]'s ?/startConversation via $lib/server/conversations.
		const resumableId = await findResumableConversation(locals.pb, locals.user.id, itemRecord.id);
		if (resumableId) {
			redirect(303, `/conversations/${resumableId}`);
		}

		const result = await startConversationAndNotify(locals.pb, locals.user, {
			id: itemRecord.id,
			ownerId: itemRecord.owner,
			name: itemRecord.name,
		});
		if (result.status === 'error') {
			return fail(result.httpStatus, { error: true, message: result.message });
		}

		redirect(303, `/conversations/${result.conversationId}`);
	},
};
