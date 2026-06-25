import { describe, it, expect, vi } from 'vitest';
import { getUserGroups, getAttachableGroups, countMembersForGroups } from './groups';

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
