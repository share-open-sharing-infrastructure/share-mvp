import { describe, it, expect, vi, beforeEach } from 'vitest';

// hooks.server.ts (re-exported by +page.server) reads PUBLIC_PB_URL from here.
vi.mock('$env/static/public', () => ({
	PUBLIC_PB_URL: 'http://localhost/',
	PUBLIC_VAPID_PUBLIC_KEY: 'x',
}));
// Avoid loading web-push + VAPID env at import time.
vi.mock('$lib/server/notifications.js', () => ({
	createNotification: vi.fn(),
	sendPushToUser: vi.fn(),
}));
// Lending-flow helpers are exercised by their own suites; stub them here.
const { getActiveTerms, hasAcceptedActiveTerms, evaluateUnmetRequirements } = vi.hoisted(() => ({
	getActiveTerms: vi.fn(),
	hasAcceptedActiveTerms: vi.fn(),
	evaluateUnmetRequirements: vi.fn(),
}));
vi.mock('$lib/server/lendingTerms', () => ({ getActiveTerms, hasAcceptedActiveTerms }));
vi.mock('$lib/server/lendingRequirements', () => ({
	evaluateUnmetRequirements,
	requirementRegistry: [],
}));

import { load, actions } from './+page.server';

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

function publicItem(extra: Record<string, unknown> = {}) {
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

/** A pb whose `users.getOne` returns the given contact prefs. When `masked` is set,
 *  items_public returns a NULL-name (restricted) row and items_searchable denies the
 *  unmask fetch — i.e. a trust/group-restricted viewer. `itemExtra` lets a test inject
 *  the public `ownerContact*` columns onto the items_public row (anonymous path). */
function makePb(opts: {
	contactMethod?: '' | 'email' | 'link';
	contactEmail?: string;
	contactUrl?: string;
	masked?: boolean;
	itemExtra?: Record<string, unknown>;
	conversationsGetFirstListItem?: ReturnType<typeof vi.fn>;
}) {
	const usersGetOne = vi.fn().mockResolvedValue({
		contactMethod: opts.contactMethod ?? '',
		contactEmail: opts.contactEmail ?? '',
		contactUrl: opts.contactUrl ?? '',
	});
	const convGetFirstListItem =
		opts.conversationsGetFirstListItem ?? vi.fn().mockRejectedValue(new Error('none'));
	const base = publicItem(opts.itemExtra);
	const itemRow = opts.masked ? { ...base, name: null } : base;
	const pb = {
		collection: vi.fn((name: string) => {
			switch (name) {
				case 'items_public':
					return {
						getOne: vi.fn().mockResolvedValue(itemRow),
						getList: vi.fn().mockResolvedValue({ totalItems: 3 }),
					};
				case 'items_searchable':
					// Unmask attempt: denied for a restricted viewer.
					return { getOne: vi.fn().mockRejectedValue(new Error('no access')) };
				case 'users':
					return {
						// ownerTrustsViewer probe — owner does not trust the viewer.
						getFirstListItem: vi.fn().mockRejectedValue(new Error('not trusted')),
						getOne: usersGetOne,
					};
				case 'conversations':
					return { getFirstListItem: convGetFirstListItem };
				default:
					return {};
			}
		}),
		filter: vi.fn(mockFilter),
		// Real PocketBase: authStore.isValid is false for a guest. Driven per-call in
		// callLoad() from whether a user is passed, so the anonymous path is faithful.
		authStore: { isValid: true },
	};
	return { pb, usersGetOne, convGetFirstListItem };
}

function callLoad(
	pb: { authStore: { isValid: boolean } },
	user: { id: string; trusts?: string[] } | null = { id: VIEWER_ID, trusts: [] }
) {
	// Mirror real PocketBase: a guest (no user) has an invalid auth store.
	pb.authStore.isValid = !!user;
	return load({
		params: { id: 'item1' },
		locals: { pb, user },
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any);
}

describe('items/[id] load — off-platform-contact owners (#438)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getActiveTerms.mockResolvedValue(null);
		hasAcceptedActiveTerms.mockResolvedValue(true);
		evaluateUnmetRequirements.mockResolvedValue([]);
	});

	it('exposes an email ownerContact and skips the in-app request flow when the owner opted in', async () => {
		const { pb, convGetFirstListItem } = makePb({
			contactMethod: 'email',
			contactEmail: 'verleih@asta-lueneburg.de',
		});

		const data = await callLoad(pb);

		expect(data.ownerContact).toEqual({ method: 'email', target: 'verleih@asta-lueneburg.de' });
		// existingConversation is still resolved (so a borrower with a live loan keeps
		// the "Zur laufenden Anfrage" link) — but terms/requirements are skipped.
		expect(convGetFirstListItem).toHaveBeenCalled();
		expect(evaluateUnmetRequirements).not.toHaveBeenCalled();
		expect(data.existingConversation).toBeNull();
		expect(data.requiresTermsAcceptance).toBe(false);
		expect(data.unmetRequirements).toEqual([]);
	});

	it('exposes a link ownerContact when the owner uses an external form', async () => {
		const { pb } = makePb({ contactMethod: 'link', contactUrl: 'https://verleih.example/form' });

		const data = await callLoad(pb);

		expect(data.ownerContact).toEqual({ method: 'link', target: 'https://verleih.example/form' });
		expect(evaluateUnmetRequirements).not.toHaveBeenCalled();
	});

	it('returns null ownerContact and runs the normal flow when the method is off', async () => {
		const { pb, convGetFirstListItem } = makePb({ contactMethod: '' });

		const data = await callLoad(pb);

		expect(data.ownerContact).toBeNull();
		expect(convGetFirstListItem).toHaveBeenCalled();
		expect(evaluateUnmetRequirements).toHaveBeenCalled();
	});

	it('falls back to the normal flow when the method is set but the target is empty', async () => {
		const { pb, usersGetOne, convGetFirstListItem } = makePb({
			contactMethod: 'email',
			contactEmail: '',
		});

		const data = await callLoad(pb);

		expect(usersGetOne).toHaveBeenCalled();
		expect(data.ownerContact).toBeNull();
		expect(convGetFirstListItem).toHaveBeenCalled();
	});

	it('never resolves a contact for a trust-restricted (masked) viewer', async () => {
		const { pb, usersGetOne } = makePb({
			contactMethod: 'email',
			contactEmail: 'verleih@asta.de',
			masked: true,
		});

		const data = await callLoad(pb);

		expect(data.isTrustRestricted).toBe(true);
		expect(data.ownerContact).toBeNull();
		// The owner-contact fetch is gated behind !isTrustRestricted.
		expect(usersGetOne).not.toHaveBeenCalled();
	});

	it('does not resolve a contact for the viewer on their own item', async () => {
		const { pb, usersGetOne } = makePb({ contactMethod: 'email', contactEmail: 'x@y.de' });

		const data = await callLoad(pb, { id: OWNER_ID, trusts: [] });

		expect(data.isOwnItem).toBe(true);
		expect(data.ownerContact).toBeNull();
		expect(usersGetOne).not.toHaveBeenCalled();
	});

	it('resolves the PUBLIC contact for an unauthenticated viewer from the items_public columns', async () => {
		// Anonymous: the owner record is unreadable, so the public contact must come from
		// the items_public row's ownerContact* columns (only populated when public).
		const { pb, usersGetOne } = makePb({
			itemExtra: {
				ownerContactMethod: 'email',
				ownerContactEmail: 'verleih@asta.de',
				ownerContactUrl: null,
			},
		});

		const data = await callLoad(pb, null);

		expect(data.ownerContact).toEqual({ method: 'email', target: 'verleih@asta.de' });
		// The base users record is never read for an anonymous viewer.
		expect(usersGetOne).not.toHaveBeenCalled();
	});

	it('shows no contact to an anonymous viewer when the public columns are NULL (members-only)', async () => {
		const { pb } = makePb({
			itemExtra: { ownerContactMethod: null, ownerContactEmail: null, ownerContactUrl: null },
		});

		const data = await callLoad(pb, null);

		expect(data.ownerContact).toBeNull();
	});

	it('never reads the base users record for an anonymous viewer of a masked item', async () => {
		// A guest (authStore invalid) on a restricted item: the SQL view already NULLs the
		// public columns, and the load must NOT fall back to the auth-only base users read.
		const { pb, usersGetOne } = makePb({
			masked: true,
			itemExtra: { ownerContactMethod: null, ownerContactEmail: null, ownerContactUrl: null },
		});

		const data = await callLoad(pb, null);

		expect(data.ownerContact).toBeNull();
		expect(usersGetOne).not.toHaveBeenCalled();
		// A guest never reaches the trust-restricted state (that requires authentication).
		expect(data.isTrustRestricted).toBe(false);
	});
});

describe('items/[id] startConversation — guard for off-platform-contact owners (#438)', () => {
	beforeEach(() => vi.clearAllMocks());

	function callStart(pb: unknown) {
		return actions.startConversation({
			locals: { pb, user: { id: VIEWER_ID, username: 'viewer' } },
			request: { formData: vi.fn().mockResolvedValue(new FormData()) },
			params: { id: 'item1' },
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);
	}

	it('rejects a direct POST with 403 and never creates a conversation (email)', async () => {
		const convCreate = vi.fn();
		const pb = {
			collection: vi.fn((name: string) => {
				if (name === 'items_public') return { getOne: vi.fn().mockResolvedValue(publicItem()) };
				if (name === 'users')
					return {
						getOne: vi
							.fn()
							.mockResolvedValue({ contactMethod: 'email', contactEmail: 'verleih@asta.de', contactUrl: '' }),
					};
				if (name === 'conversations')
					return { create: convCreate, getFullList: vi.fn().mockResolvedValue([]) };
				return {};
			}),
			filter: vi.fn(mockFilter),
		};

		const result = await callStart(pb);

		expect(result?.status).toBe(403);
		expect(convCreate).not.toHaveBeenCalled();
	});

	it('rejects a direct POST with 403 for a link-contact owner too', async () => {
		const convCreate = vi.fn();
		const pb = {
			collection: vi.fn((name: string) => {
				if (name === 'items_public') return { getOne: vi.fn().mockResolvedValue(publicItem()) };
				if (name === 'users')
					return {
						getOne: vi.fn().mockResolvedValue({
							contactMethod: 'link',
							contactEmail: '',
							contactUrl: 'https://verleih.example/form',
						}),
					};
				if (name === 'conversations')
					return { create: convCreate, getFullList: vi.fn().mockResolvedValue([]) };
				return {};
			}),
			filter: vi.fn(mockFilter),
		};

		const result = await callStart(pb);

		expect(result?.status).toBe(403);
		expect(convCreate).not.toHaveBeenCalled();
	});

	it('resumes an existing conversation before the guard, even when the owner uses off-platform contact', async () => {
		hasAcceptedActiveTerms.mockResolvedValue(true);
		const convCreate = vi.fn();
		const usersGetOne = vi
			.fn()
			.mockResolvedValue({ contactMethod: 'email', contactEmail: 'verleih@asta.de', contactUrl: '' });
		const pb = {
			collection: vi.fn((name: string) => {
				if (name === 'items_public') return { getOne: vi.fn().mockResolvedValue(publicItem()) };
				if (name === 'users') return { getOne: usersGetOne };
				if (name === 'conversations')
					return { create: convCreate, getFullList: vi.fn().mockResolvedValue([{ id: 'cExisting' }]) };
				return {};
			}),
			filter: vi.fn(mockFilter),
		};

		// The resume check runs before the off-platform-contact guard → redirect into the
		// live conversation, no 403, no new conversation, owner not even consulted.
		await expect(callStart(pb)).rejects.toMatchObject({
			status: 303,
			location: '/conversations/cExisting',
		});
		expect(convCreate).not.toHaveBeenCalled();
		expect(usersGetOne).not.toHaveBeenCalled();
	});

	it('falls through to creating a conversation when the method is set but no target is saved', async () => {
		hasAcceptedActiveTerms.mockResolvedValue(true);
		const convCreate = vi.fn().mockResolvedValue({ id: 'cNew' });
		const pb = {
			collection: vi.fn((name: string) => {
				if (name === 'items_public') return { getOne: vi.fn().mockResolvedValue(publicItem()) };
				if (name === 'users')
					return {
						getOne: vi.fn().mockResolvedValue({ contactMethod: 'email', contactEmail: '', contactUrl: '' }),
					};
				if (name === 'conversations')
					return { create: convCreate, getFullList: vi.fn().mockResolvedValue([]) };
				return {};
			}),
			filter: vi.fn(mockFilter),
		};

		// method=email but no saved address → guard must NOT block; normal create.
		await expect(callStart(pb)).rejects.toMatchObject({ status: 303 });
		expect(convCreate).toHaveBeenCalled();
	});

	it('fails open to the normal flow when the owner record is unreadable', async () => {
		hasAcceptedActiveTerms.mockResolvedValue(true);
		const convCreate = vi.fn().mockResolvedValue({ id: 'c9' });
		const pb = {
			collection: vi.fn((name: string) => {
				if (name === 'items_public') return { getOne: vi.fn().mockResolvedValue(publicItem()) };
				if (name === 'users') return { getOne: vi.fn().mockRejectedValue(new Error('unreadable')) };
				if (name === 'conversations')
					return { create: convCreate, getFullList: vi.fn().mockResolvedValue([]) };
				return {};
			}),
			filter: vi.fn(mockFilter),
		};

		// On success the action throws a 303 redirect; reaching it proves the guard
		// did not block (fail-open), and the conversation was created.
		await expect(callStart(pb)).rejects.toMatchObject({ status: 303 });
		expect(convCreate).toHaveBeenCalled();
	});
});
