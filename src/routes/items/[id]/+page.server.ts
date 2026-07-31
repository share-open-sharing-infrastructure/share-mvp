import { PUBLIC_PB_URL } from '../../../hooks.server';
import { error, fail, redirect } from '@sveltejs/kit';
import type { ItemPublic, UnmetRequirement } from '$lib/types/models';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import { hasAcceptedActiveTerms } from '$lib/server/lendingTerms';
import { evaluateUnmetRequirements } from '$lib/server/lendingRequirements';
import { getTrustDirections, NO_TRUST_DIRECTIONS } from '$lib/server/trust';
import { toggleItemStatus } from '$lib/server/items';
import {
	findResumableConversation,
	startConversationAndNotify,
} from '$lib/server/conversations';
import { getUserPreferences } from '$lib/server/userPreferences';
import {
	countOwnerItems,
	resolveExistingConversation,
	resolveOwnerContact,
	resolveTermsGate,
	resolveViewerAccess,
} from './itemDetailQueries.server';

export async function load({ params, locals }) {
	let item: ItemPublic;
	try {
		item = await locals.pb.collection('items_public').getOne(params.id, {});
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		error(e.status === 404 ? 404 : 500, 'Item not found');
	}

	const currentUserId = locals.user?.id ?? null;
	const isAuthenticated = locals.pb.authStore.isValid;
	const isOwnItem = currentUserId === item.userId;

	// From here, load() runs in three more stages ("waves"): a wave of five
	// concurrent, independent lookups right below, then two more stages that each
	// depend on the previous stage's result and so can't join that wave —
	// resolveOwnerContact needs isTrustRestricted (derived from the wave below), and
	// resolveTermsGate/evaluateUnmetRequirements need resolveOwnerContact's result.
	// No task in the wave writes `item`: resolveViewerAccess hands its un-masked fields
	// back and they are merged in once the whole wave has settled (see below).

	// Both trust directions in one query — see the doc comment on getTrustDirections
	// in trust.ts for why a Promise.all of two directional lookups would collide.
	const trustDirectionsTask = currentUserId
		? getTrustDirections(locals.pb, currentUserId, item.userId, 'trust-directions-item')
		: NO_TRUST_DIRECTIONS;
	const viewerAccessTask = resolveViewerAccess(locals.pb, item, currentUserId);
	const existingConversationTask =
		currentUserId && !isOwnItem
			? resolveExistingConversation(locals.pb, currentUserId, item.id)
			: null;
	const ownerItemCountTask = item.userId ? countOwnerItems(locals.pb, item.userId) : 0;
	// Transport mode lives in the user_preferences sidecar (issue #426), not on the
	// auth record — fetch it directly (only when authenticated) rather than via the
	// layout's `parent()`, so this already query-heavy load doesn't serialize behind
	// it. Distinct requestKey from the layout's fetch so the two concurrent reads
	// don't auto-cancel each other (PB keys by method+path).
	const preferencesTask = currentUserId
		? getUserPreferences(locals.pb, currentUserId, 'user-preferences-item')
		: null;

	const [trustDirections, viewerAccess, existingConversation, ownerItemCount, preferences] =
		await Promise.all([
			trustDirectionsTask,
			viewerAccessTask,
			existingConversationTask,
			ownerItemCountTask,
			preferencesTask,
		]);

	// Viewer → Owner direction (does the viewer trust this owner).
	const viewerTrustsOwner = trustDirections.viewerTrustsOther;
	// Whether the item owner trusts the logged-in viewer (Owner → Viewer direction).
	// Resolved server-side against the `trusts` join so no trust list reaches the client.
	const ownerTrustsViewer = !isOwnItem && trustDirections.otherTrustsViewer;

	// Apply the un-masked fields now that every wave task has settled — no sibling can
	// observe a partially un-masked item.
	if (viewerAccess.unmasked) Object.assign(item, viewerAccess.unmasked);

	const { wasMasked, viewerHasFullAccess } = viewerAccess;
	const isTrustRestricted = wasMasked && isAuthenticated && !viewerHasFullAccess;

	const preferredTransportMode = preferences?.preferredTransportMode || 'bicycle';

	const ownerContact = await resolveOwnerContact(
		locals.pb,
		item,
		currentUserId,
		!isOwnItem && !isTrustRestricted
	);

	// Terms + borrower requirements only gate the in-app request flow: viewer must be
	// logged in, not the owner, and the owner must not handle requests off-platform.
	// Neither task depends on the other, so they still run concurrently.
	const termsGateTask =
		currentUserId && !isOwnItem && !ownerContact
			? resolveTermsGate(locals.pb, currentUserId, item.userId)
			: false;
	// Lender-defined borrower requirements (#423/#389): which enabled requirements does
	// the current viewer NOT yet meet for this owner? UX only — the backend hook on
	// conversation create is the authoritative gate. Distinct requestKey from the terms
	// gate's reads so the two concurrent tasks can't auto-cancel each other.
	const unmetRequirementsTask: Promise<UnmetRequirement[]> | UnmetRequirement[] =
		currentUserId && !isOwnItem && !ownerContact && locals.user
			? evaluateUnmetRequirements(
					locals.pb,
					item.userId,
					locals.user,
					'unmet-requirements-item'
				)
			: [];

	const [requiresTermsAcceptance, unmetRequirements] = await Promise.all([
		termsGateTask,
		unmetRequirementsTask,
	]);

	return {
		item,
		PB_IMG_URL: PUBLIC_PB_URL,
		currentUserId,
		isAuthenticated,
		isTrustRestricted,
		isOwnItem,
		viewerTrustsOwner,
		ownerTrustsViewer,
		ownerItemCount,
		preferredTransportMode,
		existingConversation,
		requiresTermsAcceptance,
		unmetRequirements,
		ownerContact,
		ownerHasLocation: !!item.ownerHasLocation,
		// Issue #368 — the institution's process explanation for external items, read from the
		// already-loaded items_public row (masked to NULL for restricted items, so no extra
		// query and no leak). Empty/NULL → the component falls back to the shared default text.
		externalLendingInfo:
			(typeof item.ownerExternalLendingInfo === 'string' && item.ownerExternalLendingInfo) ||
			null,
	};
}

export const actions = {
	toggleStatus: async ({ locals, params }) => {
		if (!locals.user) {
			redirect(303, `/auth/login?redirectTo=/items/${params.id}`);
		}

		try {
			const result = await toggleItemStatus(locals.pb, params.id, locals.user.id);
			if (result.status === 'not_found') return fail(404, { fail: true, message: texts.errors.itemNotFound });
			if (result.status === 'not_owner') return fail(403, { fail: true, message: texts.errors.noPermission });
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
		}
	},

	startConversation: async ({ locals, request, params }) => {
		if (!locals.user) {
			redirect(303, `/auth/login?redirectTo=/items/${params.id}`);
		}

		// Fetch the item server-side so we never trust ownerId from form data.
		let itemRecord: ItemPublic;
		try {
			itemRecord = await locals.pb.collection('items_public').getOne(params.id);
		} catch {
			return fail(404, { fail: true, message: texts.errors.itemNotFound });
		}

		const requesterId = locals.user.id;
		const itemOwnerId = itemRecord.userId;

		// Resume an already in-progress conversation for this requester+item BEFORE any
		// other gate, so a borrower with a live loan is taken back into it — even if the
		// owner has since enabled email contact (#438) or published lending terms.
		const resumableId = await findResumableConversation(locals.pb, requesterId, params.id);
		if (resumableId) {
			redirect(303, `/conversations/${resumableId}`);
		}

		// Off-platform-contact owners (#438) handle NEW requests outside the app — the CTA
		// is a mailto: / external link, never this form. Guard the action too, so a direct
		// POST can't create a conversation the owner has opted out of ever seeing in-app.
		try {
			const owner = await locals.pb
				.collection('users')
				.getOne(itemRecord.userId, { fields: 'contactMethod,contactEmail,contactUrl' });
			const hasOffPlatformContact =
				(owner.contactMethod === 'email' && owner.contactEmail) ||
				(owner.contactMethod === 'link' && owner.contactUrl);
			if (hasOffPlatformContact) {
				return fail(403, { fail: true, message: texts.errors.contactOffPlatformOnly });
			}
		} catch {
			// Owner record unreadable → fall through to the normal flow.
		}

		// If the item's owner publishes lending terms and the user has not accepted
		// the active version, divert them through the terms acceptance flow. This
		// guards against POSTing directly to ?/startConversation past the CTA UI.
		const termsOk = await hasAcceptedActiveTerms(
			locals.pb,
			locals.user.id,
			itemRecord.userId
		);
		if (!termsOk) {
			redirect(303, `/items/${params.id}/terms`);
		}

		// No existing conversation (we'd have redirected above) → create a new one.
		await request.formData(); // consume the POST body; item resolved from params, ownerId ignored
		const result = await startConversationAndNotify(locals.pb, locals.user, {
			id: params.id,
			ownerId: itemOwnerId,
			name: itemRecord.name,
		});
		if (result.status === 'error') {
			return fail(result.httpStatus, { fail: true, message: result.message });
		}

		redirect(303, `/conversations/${result.conversationId}`);
	},
};
