import type { ItemPublic } from '$lib/types/models';
import { getAcceptance, getActiveTerms } from '$lib/server/lendingTerms';
import { OPEN_LENDING_STATES, lendingStatusFilter } from '$lib/lending';

export type ViewerAccess = {
	wasMasked: boolean;
	viewerHasFullAccess: boolean;
	/** The un-masked fields for the caller to merge into its item, or null if nothing
	 *  was un-masked. Returned rather than written into `item` so this can run inside a
	 *  concurrency wave without its siblings observing a half-mutated item. */
	unmasked: Partial<ItemPublic> | null;
};

// items_public masks RESTRICTED items (trustees-only OR shared with a group):
// name/image/description come back NULL. The owner, trusted viewers and members
// of an attached group may see full details. The base `items` rule permits the
// read only for those, so a successful privileged fetch is itself the
// authorization signal — covering trust AND group access without re-deriving
// either here. (We key off the mask, not trusteesOnly, so group-only items work.)
// We read full fields from the trust/group-filtered `items_searchable` view —
// incl. `collectionId` and the un-masked `image` — so the image file URL resolves
// (a URL built from the items_public row would 404, since its image is NULL).
// Reads `item` but never writes it; the un-masked fields come back in `unmasked`
// for the caller to apply once every concurrent sibling has settled.
export async function resolveViewerAccess(
	pb: App.Locals['pb'],
	item: ItemPublic,
	currentUserId: string | null
): Promise<ViewerAccess> {
	if (item.name != null) {
		// not masked == public == visible to everyone, nothing to un-mask
		return { wasMasked: false, viewerHasFullAccess: true, unmasked: null };
	}
	if (currentUserId) {
		try {
			const full = await pb.collection('items_searchable').getOne(item.id, {
				fields: 'collectionId,name,image,externalImgUrl,externalUrl,description',
			});
			return {
				wasMasked: true,
				viewerHasFullAccess: true,
				unmasked: {
					collectionId: full.collectionId,
					name: full.name,
					image: full.image,
					externalImgUrl: full.externalImgUrl,
					externalUrl: full.externalUrl,
					description: full.description,
				},
			};
		} catch {
			// No access -> details stay masked.
		}
	}
	// Masked and either anonymous or not permitted.
	return { wasMasked: true, viewerHasFullAccess: false, unmasked: null };
}

export type OwnerContact =
	| { method: 'email'; target: string }
	| { method: 'link'; target: string }
	| null;

// Off-platform contact opt-in (issue #438): when the owner handles requests outside
// the app, the CTA becomes a mailto: / external link instead of the in-app request
// flow. Resolution depends on the viewer:
//  - authenticated, non-owner, may-see-the-item → read the owner's base `users` record
//    (readable by any logged-in user; covers BOTH the public and members-only setting);
//  - unauthenticated → only what `items_public` exposes, i.e. the owner's PUBLIC contact
//    (contactPublic) on a fully-public item. Those `ownerContact*` columns ride on the
//    items_public row and are NULL for the members-only case, so reading them is safe.
// The raw contact fields are absent from every *_public view, so members-only never
// leaks. When resolved, the regular request flow (terms / requirements / new
// conversation) is skipped by the callers below.
export async function resolveOwnerContact(
	pb: App.Locals['pb'],
	item: ItemPublic,
	currentUserId: string | null,
	viewerMaySeeItem: boolean
): Promise<OwnerContact> {
	const pickContact = (method: unknown, email: unknown, url: unknown): OwnerContact => {
		if (method === 'email' && typeof email === 'string' && email) return { method, target: email };
		if (method === 'link' && typeof url === 'string' && url) return { method, target: url };
		return null;
	};
	if (!currentUserId) {
		return pickContact(item.ownerContactMethod, item.ownerContactEmail, item.ownerContactUrl);
	}
	if (!viewerMaySeeItem) return null;
	try {
		const owner = await pb
			.collection('users')
			.getOne(item.userId, { fields: 'contactMethod,contactEmail,contactUrl' });
		return pickContact(owner.contactMethod, owner.contactEmail, owner.contactUrl);
	} catch {
		// Owner record unreadable (e.g. unauthenticated) → fall back to normal flow.
		return null;
	}
}

// Find an in-progress conversation for this viewer + item so the CTA can link
// to it instead of creating a duplicate. We exclude rejected/completed states
// (borrower may legitimately re-request) and the empty string (conversations
// created before the lending feature was added have no lendingStatus value).
// Resolved even for email-contact owners, so a borrower with a live in-app loan
// keeps the "Zur laufenden Anfrage" entry point; the CTA prefers it over the mailto.
export async function resolveExistingConversation(
	pb: App.Locals['pb'],
	currentUserId: string,
	itemId: string
): Promise<{ id: string; lendingStatus: string } | null> {
	try {
		const conv = await pb.collection('conversations').getFirstListItem(
			pb.filter(
				'requester={:uid} && requestedItem={:iid} && ' + lendingStatusFilter(OPEN_LENDING_STATES),
				{ uid: currentUserId, iid: itemId }
			),
			{ sort: '-created', fields: 'id,lendingStatus' }
		);
		return { id: conv.id, lendingStatus: conv.lendingStatus };
	} catch {
		// No matching conversation
		return null;
	}
}

// Does this owner publish lending terms, and if so has the viewer NOT accepted them?
// Composes `getActiveTerms` + `getAcceptance` instead of calling `hasAcceptedActiveTerms`
// (which re-resolves the active terms itself) — one round-trip per lookup within one
// load(). Both reads carry a call-site-specific requestKey so a sibling task in the same
// concurrency wave reading `lending_terms`/`term_acceptances` (e.g. a future requirement's
// `evaluate`) can't auto-cancel them into a silently open gate.
export async function resolveTermsGate(
	pb: App.Locals['pb'],
	currentUserId: string,
	ownerId: string
): Promise<boolean> {
	const activeTerms = await getActiveTerms(pb, ownerId, 'terms-gate-item');
	if (!activeTerms) return false;
	return (await getAcceptance(pb, currentUserId, activeTerms.id, 'terms-acceptance-item')) === null;
}

// Total items listed by this owner (all statuses); 0 on failure.
export async function countOwnerItems(pb: App.Locals['pb'], ownerId: string): Promise<number> {
	try {
		const { totalItems } = await pb.collection('items_public').getList(1, 1, {
			filter: pb.filter('userId = {:userId}', { userId: ownerId }),
		});
		return totalItems;
	} catch {
		return 0;
	}
}
