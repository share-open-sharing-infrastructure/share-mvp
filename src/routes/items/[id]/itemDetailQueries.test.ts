import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getActiveTerms, hasAcceptedActiveTerms } = vi.hoisted(() => ({
	getActiveTerms: vi.fn(),
	hasAcceptedActiveTerms: vi.fn(),
}));
vi.mock('$lib/server/lendingTerms', () => ({ getActiveTerms, hasAcceptedActiveTerms }));

import {
	resolveViewerAccess,
	resolveOwnerContact,
	resolveExistingConversation,
	resolveTermsGate,
	countOwnerItems,
} from './itemDetailQueries';

function mockFilter(raw: string, params?: Record<string, unknown>): string {
	if (!params) return raw;
	let result = raw;
	for (const [key, value] of Object.entries(params)) {
		const escaped = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : `${value}`;
		result = result.replaceAll(`{:${key}}`, escaped);
	}
	return result;
}

const OWNER_ID = 'owner1';
const VIEWER_ID = 'viewer1';

function publicItem(extra: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: 'item1',
		name: 'Bohrmaschine',
		userId: OWNER_ID,
		status: 'available',
		trusteesOnly: false,
		ownerHasLocation: false,
		...extra,
	};
}

describe('resolveViewerAccess', () => {
	beforeEach(() => vi.clearAllMocks());

	it('reports no mask and full access when the item was not masked', async () => {
		const getOne = vi.fn();
		const pb = { collection: vi.fn(() => ({ getOne })) };
		const item = publicItem();

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveViewerAccess(pb as any, item as any, VIEWER_ID);

		expect(result).toEqual({ wasMasked: false, viewerHasFullAccess: true });
		expect(getOne).not.toHaveBeenCalled();
	});

	it('does not attempt to unmask a masked item for an anonymous viewer', async () => {
		const getOne = vi.fn();
		const pb = { collection: vi.fn(() => ({ getOne })) };
		const item = publicItem({ name: null });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveViewerAccess(pb as any, item as any, null);

		expect(result).toEqual({ wasMasked: true, viewerHasFullAccess: false });
		expect(getOne).not.toHaveBeenCalled();
		expect(item.name).toBeNull();
	});

	it('unmasks the item in place when items_searchable grants access', async () => {
		const getOne = vi.fn().mockResolvedValue({
			collectionId: 'col1',
			name: 'Bohrmaschine',
			image: 'img.jpg',
			externalImgUrl: null,
			externalUrl: null,
			description: 'Kraftvoll',
		});
		const pb = { collection: vi.fn(() => ({ getOne })) };
		const item = publicItem({ name: null, image: null });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveViewerAccess(pb as any, item as any, VIEWER_ID);

		expect(result).toEqual({ wasMasked: true, viewerHasFullAccess: true });
		expect(item.name).toBe('Bohrmaschine');
		expect(item.image).toBe('img.jpg');
		expect(getOne).toHaveBeenCalledWith(
			'item1',
			expect.objectContaining({ fields: expect.stringContaining('name') })
		);
	});

	it('leaves the item masked when items_searchable denies access', async () => {
		const getOne = vi.fn().mockRejectedValue(new Error('no access'));
		const pb = { collection: vi.fn(() => ({ getOne })) };
		const item = publicItem({ name: null });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveViewerAccess(pb as any, item as any, VIEWER_ID);

		expect(result).toEqual({ wasMasked: true, viewerHasFullAccess: false });
		expect(item.name).toBeNull();
	});
});

describe('resolveOwnerContact', () => {
	beforeEach(() => vi.clearAllMocks());

	it('reads the public ownerContact* columns for an anonymous viewer', async () => {
		const usersGetOne = vi.fn();
		const pb = { collection: vi.fn(() => ({ getOne: usersGetOne })) };
		const item = publicItem({
			ownerContactMethod: 'email',
			ownerContactEmail: 'verleih@asta.de',
			ownerContactUrl: null,
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveOwnerContact(pb as any, item as any, null, true);

		expect(result).toEqual({ method: 'email', target: 'verleih@asta.de' });
		expect(usersGetOne).not.toHaveBeenCalled();
	});

	it('returns null for an anonymous viewer when the public columns are NULL', async () => {
		const pb = { collection: vi.fn(() => ({ getOne: vi.fn() })) };
		const item = publicItem({
			ownerContactMethod: null,
			ownerContactEmail: null,
			ownerContactUrl: null,
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveOwnerContact(pb as any, item as any, null, true);

		expect(result).toBeNull();
	});

	it('returns null without reading the owner record when the viewer may not see the item', async () => {
		const usersGetOne = vi.fn();
		const pb = { collection: vi.fn(() => ({ getOne: usersGetOne })) };
		const item = publicItem();

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveOwnerContact(pb as any, item as any, VIEWER_ID, false);

		expect(result).toBeNull();
		expect(usersGetOne).not.toHaveBeenCalled();
	});

	it('reads the base users record for an authenticated viewer who may see the item', async () => {
		const usersGetOne = vi
			.fn()
			.mockResolvedValue({ contactMethod: 'link', contactEmail: '', contactUrl: 'https://x.de' });
		const pb = { collection: vi.fn(() => ({ getOne: usersGetOne })) };
		const item = publicItem();

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveOwnerContact(pb as any, item as any, VIEWER_ID, true);

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
		const pb = { collection: vi.fn(() => ({ getOne: usersGetOne })) };
		const item = publicItem();

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveOwnerContact(pb as any, item as any, VIEWER_ID, true);

		expect(result).toBeNull();
	});

	it('falls back to null when the owner record is unreadable', async () => {
		const usersGetOne = vi.fn().mockRejectedValue(new Error('unreadable'));
		const pb = { collection: vi.fn(() => ({ getOne: usersGetOne })) };
		const item = publicItem();

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveOwnerContact(pb as any, item as any, VIEWER_ID, true);

		expect(result).toBeNull();
	});
});

describe('resolveExistingConversation', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns the id and lendingStatus of a matching open conversation', async () => {
		const getFirstListItem = vi
			.fn()
			.mockResolvedValue({ id: 'conv1', lendingStatus: 'accepted' });
		const pb = {
			collection: vi.fn(() => ({ getFirstListItem })),
			filter: vi.fn(mockFilter),
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveExistingConversation(pb as any, VIEWER_ID, 'item1');

		expect(result).toEqual({ id: 'conv1', lendingStatus: 'accepted' });
		expect(getFirstListItem).toHaveBeenCalledWith(
			expect.stringContaining(`requester='${VIEWER_ID}'`),
			expect.objectContaining({ sort: '-created' })
		);
	});

	it('returns null when no matching conversation exists', async () => {
		const getFirstListItem = vi.fn().mockRejectedValue(new Error('none'));
		const pb = {
			collection: vi.fn(() => ({ getFirstListItem })),
			filter: vi.fn(mockFilter),
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveExistingConversation(pb as any, VIEWER_ID, 'item1');

		expect(result).toBeNull();
	});
});

describe('resolveTermsGate', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns false when the owner has no active terms', async () => {
		getActiveTerms.mockResolvedValue(null);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveTermsGate({} as any, VIEWER_ID, OWNER_ID);

		expect(result).toBe(false);
		expect(hasAcceptedActiveTerms).not.toHaveBeenCalled();
	});

	it('returns false when active terms exist and the viewer already accepted them', async () => {
		getActiveTerms.mockResolvedValue({ id: 'terms1' });
		hasAcceptedActiveTerms.mockResolvedValue(true);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveTermsGate({} as any, VIEWER_ID, OWNER_ID);

		expect(result).toBe(false);
	});

	it('returns true (gate the request) when active terms exist and the viewer has not accepted them', async () => {
		getActiveTerms.mockResolvedValue({ id: 'terms1' });
		hasAcceptedActiveTerms.mockResolvedValue(false);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await resolveTermsGate({} as any, VIEWER_ID, OWNER_ID);

		expect(result).toBe(true);
	});
});

describe('countOwnerItems', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns the total item count for the owner', async () => {
		const getList = vi.fn().mockResolvedValue({ totalItems: 5 });
		const pb = { collection: vi.fn(() => ({ getList })), filter: vi.fn(mockFilter) };

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await countOwnerItems(pb as any, OWNER_ID);

		expect(result).toBe(5);
		expect(getList).toHaveBeenCalledWith(1, 1, expect.objectContaining({ filter: expect.any(String) }));
	});

	it('returns 0 when the query fails', async () => {
		const getList = vi.fn().mockRejectedValue(new Error('boom'));
		const pb = { collection: vi.fn(() => ({ getList })), filter: vi.fn(mockFilter) };

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await countOwnerItems(pb as any, OWNER_ID);

		expect(result).toBe(0);
	});
});
