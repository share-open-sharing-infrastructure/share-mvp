import { PUBLIC_PB_URL } from '../../../hooks.server';
import { error, fail, redirect } from '@sveltejs/kit';
import type { ItemPublic } from '$lib/types/models';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import { getActiveTerms, hasAcceptedActiveTerms } from '$lib/server/lendingTerms';
import { evaluateUnmetRequirements } from '$lib/server/lendingRequirements';
import { isTrusting } from '$lib/server/trust';
import { toggleItemStatus } from '$lib/server/items';
import {
	findResumableConversation,
	startConversationAndNotify,
} from '$lib/server/conversations';
import { getUserPreferences } from '$lib/server/userPreferences';
import { OPEN_LENDING_STATES, lendingStatusFilter } from '$lib/lending';

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
	// Viewer → Owner direction (does the viewer trust this owner).
	const viewerTrustsOwner = currentUserId
		? await isTrusting(locals.pb, currentUserId, item.userId)
		: false;

	// Whether the item owner trusts the logged-in viewer (Owner → Viewer direction).
	// Resolved server-side against the `trusts` join so no trust list reaches the client.
	const ownerTrustsViewer =
		currentUserId && !isOwnItem ? await isTrusting(locals.pb, item.userId, currentUserId) : false;

	// items_public masks RESTRICTED items (trustees-only OR shared with a group):
	// name/image/description come back NULL. The owner, trusted viewers and members
	// of an attached group may see full details. The base `items` rule permits the
	// read only for those, so a successful privileged fetch is itself the
	// authorization signal — covering trust AND group access without re-deriving
	// either here. (We key off the mask, not trusteesOnly, so group-only items work.)
	// We read full fields from the trust/group-filtered `items_searchable` view —
	// incl. `collectionId` and the un-masked `image` — so the image file URL resolves
	// (a URL built from the items_public row would 404, since its image is NULL).
	const wasMasked = item.name == null;
	let viewerHasFullAccess = !wasMasked; // unmasked == public == visible to everyone
	if (wasMasked && currentUserId) {
		try {
			const full = await locals.pb.collection('items_searchable').getOne(item.id, {
				fields: 'collectionId,name,image,externalImgUrl,externalUrl,description',
			});
			item.collectionId = full.collectionId;
			item.name = full.name;
			item.image = full.image;
			item.externalImgUrl = full.externalImgUrl;
			item.externalUrl = full.externalUrl;
			item.description = full.description;
			viewerHasFullAccess = true;
		} catch {
			// No access (or not logged in) -> details stay masked.
		}
	}

	const isTrustRestricted = wasMasked && isAuthenticated && !viewerHasFullAccess;

	// Off-platform contact opt-in (issue #438): when the owner handles requests outside
	// the app, the CTA becomes a mailto: / external link instead of the in-app request
	// flow. Resolution depends on the viewer:
	//  - authenticated, non-owner, may-see-the-item → read the owner's base `users` record
	//    (readable by any logged-in user; covers BOTH the public and members-only setting);
	//  - unauthenticated → only what `items_public` exposes, i.e. the owner's PUBLIC contact
	//    (contactPublic) on a fully-public item. Those `ownerContact*` columns ride on the
	//    items_public row and are NULL for the members-only case, so reading them is safe.
	// The raw contact fields are absent from every *_public view, so members-only never
	// leaks. When resolved, the regular-flow computations below are skipped (terms /
	// requirements / new conversation are irrelevant to off-platform contact).
	const pickContact = (
		method: unknown,
		email: unknown,
		url: unknown
	): { method: 'email'; target: string } | { method: 'link'; target: string } | null => {
		if (method === 'email' && typeof email === 'string' && email) return { method, target: email };
		if (method === 'link' && typeof url === 'string' && url) return { method, target: url };
		return null;
	};
	let ownerContact: ReturnType<typeof pickContact> = null;
	if (currentUserId && !isOwnItem && !isTrustRestricted) {
		try {
			const owner = await locals.pb
				.collection('users')
				.getOne(item.userId, { fields: 'contactMethod,contactEmail,contactUrl' });
			ownerContact = pickContact(owner.contactMethod, owner.contactEmail, owner.contactUrl);
		} catch {
			// Owner record unreadable (e.g. unauthenticated) → fall back to normal flow.
		}
	} else if (!currentUserId) {
		ownerContact = pickContact(item.ownerContactMethod, item.ownerContactEmail, item.ownerContactUrl);
	}

	// Find an in-progress conversation for this viewer + item so the CTA can link
	// to it instead of creating a duplicate. We exclude rejected/completed states
	// (borrower may legitimately re-request) and the empty string (conversations
	// created before the lending feature was added have no lendingStatus value).
	// Resolved even for email-contact owners, so a borrower with a live in-app loan
	// keeps the "Zur laufenden Anfrage" entry point; the CTA prefers it over the mailto.
	let existingConversation: { id: string; lendingStatus: string } | null = null;
	if (currentUserId && !isOwnItem) {
		try {
			const conv = await locals.pb.collection('conversations').getFirstListItem(
				locals.pb.filter(
					'requester={:uid} && requestedItem={:iid} && ' + lendingStatusFilter(OPEN_LENDING_STATES),
					{ uid: currentUserId, iid: item.id }
				),
				{ sort: '-created', fields: 'id,lendingStatus' }
			);
			existingConversation = { id: conv.id, lendingStatus: conv.lendingStatus };
		} catch {
			// No matching conversation — leave null
		}
	}

	// Does this owner publish lending terms, and if so has the viewer accepted them?
	// We only gate the request flow on terms when the viewer is logged in and not the owner.
	let requiresTermsAcceptance = false;
	if (currentUserId && !isOwnItem && !ownerContact) {
		const ownerId = item.userId;
		const activeTerms = await getActiveTerms(locals.pb, ownerId);
		if (activeTerms) {
			const accepted = await hasAcceptedActiveTerms(locals.pb, currentUserId, ownerId);
			requiresTermsAcceptance = !accepted;
		}
	}

	// Lender-defined borrower requirements (#423/#389): which enabled requirements
	// does the current viewer NOT yet meet for this owner? UX only — the backend
	// hook on conversation create is the authoritative gate. We skip own items and
	// unauthenticated viewers (login is required before requesting anyway).
	let unmetRequirements: Awaited<ReturnType<typeof evaluateUnmetRequirements>> = [];
	if (currentUserId && !isOwnItem && !ownerContact && locals.user) {
		unmetRequirements = await evaluateUnmetRequirements(locals.pb, item.userId, locals.user);
	}

	// Total items listed by this owner (all statuses).
	let ownerItemCount = 0;
	if (item.userId) {
		try {
			const { totalItems } = await locals.pb
				.collection('items_public')
				.getList(1, 1, {
					filter: locals.pb.filter('userId = {:userId}', { userId: item.userId }),
				});
			ownerItemCount = totalItems;
		} catch {
			// silently fall back to 0
		}
	}

	// Transport mode lives in the user_preferences sidecar (issue #426), not on the
	// auth record — fetch it directly (only when authenticated) rather than via the
	// layout's `parent()`, so this already query-heavy load doesn't serialize behind it.
	// Distinct requestKey from the layout's fetch so the two concurrent reads don't
	// auto-cancel each other (PB keys by method+path).
	const preferredTransportMode =
		(currentUserId
			? (await getUserPreferences(locals.pb, currentUserId, 'user-preferences-item'))
					?.preferredTransportMode
			: null) || 'bicycle';

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
