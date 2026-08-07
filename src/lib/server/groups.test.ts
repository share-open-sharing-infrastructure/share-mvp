import { describe, it, expect, vi } from 'vitest';
import {
	getUserGroups,
	getAttachableGroups,
	countMembersForGroups,
	requireGroupMembership,
	isGroupOwner,
} from './groups';

// Minimal PocketBase stub. `group_members.getFullList` is called twice with
// different intents — with `expand: 'group'` for the membership list, and with
// `fields: 'group'` for the count tally — so the stub branches on the options.
function makePb(opts: {
	owned?: unknown[];
	memberships?: unknown[];
	memberRows?: { group: string }[];
}) {
	const { owned = [], memberships = [], memberRows = [] } = opts;
	return {
		filter: (raw: string) => raw,
		collection: vi.fn((name: string) => {
			if (name === 'groups') {
				return { getFullList: vi.fn().mockResolvedValue(owned) };
			}
			if (name === 'group_members') {
				return {
					getFullList: vi.fn((o?: { expand?: string; fields?: string }) =>
						Promise.resolve(o?.expand === 'group' ? memberships : memberRows)
					),
				};
			}
			return {};
		}),
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

describe('countMembersForGroups', () => {
	it('returns an empty map for no group ids (and issues no query)', async () => {
		const pb = makePb({});
		const res = await countMembersForGroups(pb, []);
		expect(res.size).toBe(0);
		expect(pb.collection).not.toHaveBeenCalled();
	});

	it('tallies member rows per group and reports 0 for groups with no members', async () => {
		const pb = makePb({ memberRows: [{ group: 'g1' }, { group: 'g1' }, { group: 'g2' }] });
		const res = await countMembersForGroups(pb, ['g1', 'g2', 'g3']);
		expect(res.get('g1')).toBe(2);
		expect(res.get('g2')).toBe(1);
		expect(res.get('g3')).toBe(0); // no rows -> still present, zero
	});

	it('does the count in a single query (no N+1)', async () => {
		const pb = makePb({ memberRows: [{ group: 'g1' }] });
		await countMembersForGroups(pb, ['g1', 'g2']);
		// one collection() lookup -> one getFullList call
		expect(pb.collection).toHaveBeenCalledTimes(1);
	});
});

describe('getUserGroups', () => {
	it('splits owned vs member groups and attaches member counts', async () => {
		const pb = makePb({
			owned: [{ id: 'g1', name: 'Nord', owner: 'me', description: 'd' }],
			memberships: [{ expand: { group: { id: 'g2', name: 'Süd', owner: 'other' } } }],
			memberRows: [{ group: 'g1' }, { group: 'g1' }, { group: 'g2' }],
		});

		const { owned, member } = await getUserGroups(pb, 'me');

		expect(owned).toEqual([
			{ id: 'g1', name: 'Nord', description: 'd', owner: 'me', isOwner: true, isPublic: false, memberCount: 2 },
		]);
		expect(member).toEqual([
			{ id: 'g2', name: 'Süd', description: undefined, owner: 'other', isOwner: false, isPublic: false, memberCount: 1 },
		]);
	});

	it('skips memberships whose expanded group is missing', async () => {
		const pb = makePb({
			owned: [],
			memberships: [{ expand: {} }, { expand: { group: { id: 'g2', name: 'X', owner: 'o' } } }],
			memberRows: [],
		});
		const { member } = await getUserGroups(pb, 'me');
		expect(member).toHaveLength(1);
		expect(member[0].id).toBe('g2');
	});
});

describe('getAttachableGroups', () => {
	it('merges owned + member groups, deduplicates by id, sorts by name, omits counts', async () => {
		const pb = makePb({
			owned: [{ id: 'g1', name: 'Zebra', owner: 'me' }],
			// g1 also appears as a membership (shouldn't duplicate); g2 is new
			memberships: [
				{ expand: { group: { id: 'g1', name: 'Zebra', owner: 'me' } } },
				{ expand: { group: { id: 'g2', name: 'Alpha', owner: 'other' } } },
			],
		});

		const res = await getAttachableGroups(pb, 'me');

		expect(res).toEqual([
			{ id: 'g2', name: 'Alpha', isPublic: false },
			{ id: 'g1', name: 'Zebra', isPublic: false },
		]);
	});

	it('returns an empty list when the user has no groups', async () => {
		const pb = makePb({});
		expect(await getAttachableGroups(pb, 'me')).toEqual([]);
	});
});

describe('requireGroupMembership', () => {
	// Minimal pb stub: groups.getOne resolves the group (or rejects), group_members.getFullList
	// returns the roster.
	function pbFor(opts: { group?: unknown; groupErr?: unknown; members?: unknown[] }) {
		return {
			filter: (raw: string) => raw,
			collection: vi.fn((name: string) => {
				if (name === 'groups') {
					return {
						getOne: opts.groupErr
							? vi.fn().mockRejectedValue(opts.groupErr)
							: vi.fn().mockResolvedValue(opts.group),
					};
				}
				if (name === 'group_members') {
					return { getFullList: vi.fn().mockResolvedValue(opts.members ?? []) };
				}
				return {};
			}),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
	}

	it('throws 404 when the group does not exist', async () => {
		const pb = pbFor({ groupErr: { status: 404 } });
		await expect(requireGroupMembership(pb, 'me', 'bad')).rejects.toMatchObject({ status: 404 });
	});

	it('redirects to the group list when the user is neither owner nor member', async () => {
		const pb = pbFor({ group: { id: 'g1', owner: 'someone-else' }, members: [{ user: 'other' }] });
		await expect(requireGroupMembership(pb, 'me', 'g1')).rejects.toMatchObject({
			status: 303,
			location: '/user/groups',
		});
	});

	it('returns isOwner true for the owner', async () => {
		const pb = pbFor({ group: { id: 'g1', owner: 'me' }, members: [{ user: 'me', role: 'admin' }] });
		const res = await requireGroupMembership(pb, 'me', 'g1');
		expect(res.isOwner).toBe(true);
		expect(res.group.id).toBe('g1');
		expect(res.memberRows).toHaveLength(1);
	});

	it('returns isOwner false for a plain member', async () => {
		const pb = pbFor({
			group: { id: 'g1', owner: 'someone-else' },
			members: [{ user: 'someone-else', role: 'admin' }, { user: 'me', role: 'member' }],
		});
		const res = await requireGroupMembership(pb, 'me', 'g1');
		expect(res.isOwner).toBe(false);
	});
});

describe('isGroupOwner', () => {
	function ownerPb(group?: unknown, err?: unknown) {
		return {
			collection: vi.fn(() => ({
				getOne: err ? vi.fn().mockRejectedValue(err) : vi.fn().mockResolvedValue(group),
			})),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
	}

	it('is true when the user owns the group', async () => {
		expect(await isGroupOwner(ownerPb({ id: 'g1', owner: 'me' }), 'me', 'g1')).toBe(true);
	});

	it('is false for a non-owner', async () => {
		expect(await isGroupOwner(ownerPb({ id: 'g1', owner: 'someone-else' }), 'me', 'g1')).toBe(false);
	});

	it('is false when the group cannot be fetched', async () => {
		expect(await isGroupOwner(ownerPb(undefined, { status: 404 }), 'me', 'bad')).toBe(false);
	});
});
