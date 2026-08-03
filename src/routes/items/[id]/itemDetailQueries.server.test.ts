import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ItemPublic } from '$lib/types/models';
import { makeMockPb } from '$lib/test-utils/pocketbase';

const { hasAcceptedActiveTerms } = vi.hoisted(() => ({
	hasAcceptedActiveTerms: vi.fn(),
}));
vi.mock('$lib/server/lendingTerms', () => ({ hasAcceptedActiveTerms }));

import {
	resolveViewerAccess,
	resolveOwnerContact,
	resolveExistingConversation,
	resolveTermsGate,
	countOwnerItems,
} from './itemDetailQueries.server';

const OWNER_ID = 'owner1';
const VIEWER_ID = 'viewer1';

// Only the fields these helpers actually read; cast once here instead of at every call site.
function publicItem(extra: Record<string, unknown> = {}): ItemPublic {
	return {
		id: 'item1',
		name: 'Bohrmaschine',
		userId: OWNER_ID,
		status: 'available',
		trusteesOnly: false,
		ownerHasLocation: 0,
		...extra,
	} as unknown as ItemPublic;
}

describe('resolveViewerAccess', () => {
	beforeEach(() => vi.clearAllMocks());

	it('reports no mask and full access when the item was not masked', async () => {
		const getOne = vi.fn();
		const pb = makeMockPb({ items_searchable: { getOne } });
		const item = publicItem();

		const result = await resolveViewerAccess(pb, item, VIEWER_ID);

		expect(result).toEqual({ wasMasked: false, viewerHasFullAccess: true, unmasked: null });
		expect(getOne).not.toHaveBeenCalled();
	});

	it('does not attempt to unmask a masked item for an anonymous viewer', async () => {
		const getOne = vi.fn();
		const pb = makeMockPb({ items_searchable: { getOne } });
		const item = publicItem({ name: null });

		const result = await resolveViewerAccess(pb, item, null);

		expect(result).toEqual({ wasMasked: true, viewerHasFullAccess: false, unmasked: null });
		expect(getOne).not.toHaveBeenCalled();
		expect(item.name).toBeNull();
	});

	it('returns the un-masked fields — without touching the item — when items_searchable grants access', async () => {
		const getOne = vi.fn().mockResolvedValue({
			collectionId: 'col1',
			name: 'Bohrmaschine',
			image: 'img.jpg',
			externalImgUrl: null,
			externalUrl: null,
			description: 'Kraftvoll',
		});
		const pb = makeMockPb({ items_searchable: { getOne } });
		const item = publicItem({ name: null, image: null });

		const result = await resolveViewerAccess(pb, item, VIEWER_ID);

		expect(result).toEqual({
			wasMasked: true,
			viewerHasFullAccess: true,
			unmasked: {
				collectionId: 'col1',
				name: 'Bohrmaschine',
				image: 'img.jpg',
				externalImgUrl: null,
				externalUrl: null,
				description: 'Kraftvoll',
			},
		});
		// The item itself stays untouched: siblings in the same concurrency wave must
		// never observe a half-un-masked item (the caller merges after the wave).
		expect(item.name).toBeNull();
		expect(item.image).toBeNull();
		expect(getOne).toHaveBeenCalledWith(
			'item1',
			expect.objectContaining({ fields: expect.stringContaining('name') })
		);
	});

	it('leaves the item masked when items_searchable denies access', async () => {
		const getOne = vi.fn().mockRejectedValue(new Error('no access'));
		const pb = makeMockPb({ items_searchable: { getOne } });
		const item = publicItem({ name: null });

		const result = await resolveViewerAccess(pb, item, VIEWER_ID);

		expect(result).toEqual({ wasMasked: true, viewerHasFullAccess: false, unmasked: null });
		expect(item.name).toBeNull();
	});
});

describe('resolveOwnerContact', () => {
	beforeEach(() => vi.clearAllMocks());

	it('reads the public ownerContact* columns for an anonymous viewer', async () => {
		const usersGetOne = vi.fn();
		const pb = makeMockPb({ users: { getOne: usersGetOne } });
		const item = publicItem({
			ownerContactMethod: 'email',
			ownerContactEmail: 'verleih@asta.de',
			ownerContactUrl: null,
		});

		const result = await resolveOwnerContact(pb, item, null, true);

		expect(result).toEqual({ method: 'email', target: 'verleih@asta.de' });
		expect(usersGetOne).not.toHaveBeenCalled();
	});

	it('returns null for an anonymous viewer when the public columns are NULL', async () => {
		const pb = makeMockPb({ users: { getOne: vi.fn() } });
		const item = publicItem({
			ownerContactMethod: null,
			ownerContactEmail: null,
			ownerContactUrl: null,
		});

		const result = await resolveOwnerContact(pb, item, null, true);

		expect(result).toBeNull();
	});

	it('returns null without reading the owner record when the viewer may not see the item', async () => {
		const usersGetOne = vi.fn();
		const pb = makeMockPb({ users: { getOne: usersGetOne } });
		const item = publicItem();

		const result = await resolveOwnerContact(pb, item, VIEWER_ID, false);

		expect(result).toBeNull();
		expect(usersGetOne).not.toHaveBeenCalled();
	});

	it('reads the base users record for an authenticated viewer who may see the item', async () => {
		const usersGetOne = vi
			.fn()
			.mockResolvedValue({ contactMethod: 'link', contactEmail: '', contactUrl: 'https://x.de' });
		const pb = makeMockPb({ users: { getOne: usersGetOne } });
		const item = publicItem();

		const result = await resolveOwnerContact(pb, item, VIEWER_ID, true);

		expect(result).toEqual({ method: 'link', target: 'https://x.de' });
		expect(usersGetOne).toHaveBeenCalledWith(
			OWNER_ID,
			expect.objectContaining({ fields: expect.stringContaining('contactMethod') })
		);
	});

	it('falls back to null when the method is set but the target is empty', async () => {
		const usersGetOne = vi
			.fn()
			.mockResolvedValue({ contactMethod: 'email', contactEmail: '', contactUrl: '' });
		const pb = makeMockPb({ users: { getOne: usersGetOne } });
		const item = publicItem();

		const result = await resolveOwnerContact(pb, item, VIEWER_ID, true);

		expect(result).toBeNull();
	});

	it('falls back to null when the owner record is unreadable', async () => {
		const usersGetOne = vi.fn().mockRejectedValue(new Error('unreadable'));
		const pb = makeMockPb({ users: { getOne: usersGetOne } });
		const item = publicItem();

		const result = await resolveOwnerContact(pb, item, VIEWER_ID, true);

		expect(result).toBeNull();
	});
});

describe('resolveExistingConversation', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns the id and lendingStatus of a matching open conversation', async () => {
		const getFirstListItem = vi.fn().mockResolvedValue({ id: 'conv1', lendingStatus: 'accepted' });
		const pb = makeMockPb({ conversations: { getFirstListItem } });

		const result = await resolveExistingConversation(pb, VIEWER_ID, 'item1');

		expect(result).toEqual({ id: 'conv1', lendingStatus: 'accepted' });
		expect(getFirstListItem).toHaveBeenCalledWith(
			expect.stringContaining(`requester='${VIEWER_ID}'`),
			expect.objectContaining({ sort: '-created' })
		);
	});

	it('returns null when no matching conversation exists', async () => {
		const getFirstListItem = vi.fn().mockRejectedValue(new Error('none'));
		const pb = makeMockPb({ conversations: { getFirstListItem } });

		const result = await resolveExistingConversation(pb, VIEWER_ID, 'item1');

		expect(result).toBeNull();
	});
});

describe('resolveTermsGate', () => {
	beforeEach(() => vi.clearAllMocks());

	// `pb` is only forwarded to the mocked `hasAcceptedActiveTerms`, never queried here.
	const pb = makeMockPb({});

	it('returns false when hasAcceptedActiveTerms reports the terms as satisfied (no active terms, or already accepted)', async () => {
		hasAcceptedActiveTerms.mockResolvedValue(true);

		const result = await resolveTermsGate(pb, VIEWER_ID, OWNER_ID);

		expect(result).toBe(false);
	});

	it('returns true (gate the request) when hasAcceptedActiveTerms reports the terms as not accepted', async () => {
		hasAcceptedActiveTerms.mockResolvedValue(false);

		const result = await resolveTermsGate(pb, VIEWER_ID, OWNER_ID);

		expect(result).toBe(true);
	});

	// The point of #615's dedupe: resolveTermsGate delegates to `hasAcceptedActiveTerms`
	// instead of re-implementing its getActiveTerms→getAcceptance composition, so the
	// "no active terms" / "most recent acceptance" rules live in one place and the round
	// trip cost (2 reads: active terms + acceptance) can't drift from that helper's.
	// Both request keys still travel through, distinct, so a sibling task in load()'s W4
	// wave (e.g. evaluateUnmetRequirements) can't auto-cancel either read.
	it('delegates to hasAcceptedActiveTerms exactly once, with the item-detail request keys', async () => {
		hasAcceptedActiveTerms.mockResolvedValue(false);

		await resolveTermsGate(pb, VIEWER_ID, OWNER_ID);

		expect(hasAcceptedActiveTerms).toHaveBeenCalledTimes(1);
		expect(hasAcceptedActiveTerms).toHaveBeenCalledWith(pb, VIEWER_ID, OWNER_ID, {
			termsRequestKey: 'terms-gate-item',
			acceptanceRequestKey: 'terms-acceptance-item',
		});
	});
});

describe('countOwnerItems', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns the total item count for the owner', async () => {
		const getList = vi.fn().mockResolvedValue({ totalItems: 5 });
		const pb = makeMockPb({ items_public: { getList } });

		const result = await countOwnerItems(pb, OWNER_ID);

		expect(result).toBe(5);
		// Explicit requestKey (#615 fix 2): getList's default auto-cancellation key is just
		// `method + path` and ignores the query string, so without this a second concurrent
		// items_public.getList anywhere in the request would silently cancel this one.
		expect(getList).toHaveBeenCalledWith(
			1,
			1,
			expect.objectContaining({
				filter: expect.stringContaining(`userId = '${OWNER_ID}'`),
				requestKey: 'owner-item-count-item',
			})
		);
	});

	it('returns 0 when the query fails', async () => {
		const getList = vi.fn().mockRejectedValue(new Error('boom'));
		const pb = makeMockPb({ items_public: { getList } });

		const result = await countOwnerItems(pb, OWNER_ID);

		expect(result).toBe(0);
	});
});
