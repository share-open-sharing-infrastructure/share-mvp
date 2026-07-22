import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSuperuserClient } = vi.hoisted(() => ({ getSuperuserClient: vi.fn() }));

vi.mock('$lib/server/integrations/core/pocketbase', () => ({ getSuperuserClient }));

import {
	isAdmin,
	getLiveCoreMetrics,
	getMetricsHistory,
	getPublicStats,
	_resetPublicStatsCacheForTests,
} from './metrics';

const FAKE_SNAPSHOT_METRICS = {
	community: { groups: { total: 7 }, trusts: { edges: 5 } },
	messages: { total: 42 },
	activeUsers: { loans30d_2plus: 4 },
};

function fakePb(getListImpl?: () => Promise<{ totalItems: number }>) {
	return {
		filter: vi.fn((raw: string) => raw),
		collection: vi.fn(() => ({
			getList: vi.fn(getListImpl ?? (() => Promise.resolve({ totalItems: 3 }))),
			getFullList: vi.fn().mockResolvedValue([]),
			getOne: vi.fn().mockResolvedValue({ id: 'unused', isAdmin: false }),
			getFirstListItem: vi.fn().mockResolvedValue({ date: '2026-07-20', metrics: FAKE_SNAPSHOT_METRICS }),
		})),
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	_resetPublicStatsCacheForTests();
});

describe('isAdmin', () => {
	it('returns true when the superuser lookup finds users.isAdmin = true', async () => {
		const pb = fakePb();
		pb.collection = vi.fn(() => ({ getOne: vi.fn().mockResolvedValue({ id: 'u1', isAdmin: true }) })) as unknown as typeof pb.collection;
		getSuperuserClient.mockResolvedValue(pb);

		expect(await isAdmin('u1')).toBe(true);
		expect(pb.collection).toHaveBeenCalledWith('users');
	});

	it('returns false when users.isAdmin is false', async () => {
		const pb = fakePb();
		pb.collection = vi.fn(() => ({ getOne: vi.fn().mockResolvedValue({ id: 'u1', isAdmin: false }) })) as unknown as typeof pb.collection;
		getSuperuserClient.mockResolvedValue(pb);

		expect(await isAdmin('u1')).toBe(false);
	});

	it('returns false for a missing user id, without querying PocketBase', async () => {
		expect(await isAdmin(null)).toBe(false);
		expect(await isAdmin(undefined)).toBe(false);
		expect(getSuperuserClient).not.toHaveBeenCalled();
	});

	it('fails soft to false if the lookup throws (deleted user, DB hiccup, …)', async () => {
		const pb = fakePb();
		pb.collection = vi.fn(() => ({ getOne: vi.fn().mockRejectedValue(new Error('not found')) })) as unknown as typeof pb.collection;
		getSuperuserClient.mockResolvedValue(pb);

		expect(await isAdmin('missing-id')).toBe(false);
	});
});

describe('getLiveCoreMetrics', () => {
	it('returns the users/items/loans shape from cheap getList(1,1) counts', async () => {
		const pb = fakePb();
		getSuperuserClient.mockResolvedValue(pb);

		const result = await getLiveCoreMetrics();

		expect(result.users).toEqual({ total: 3, institutions: 3, verified: 3 });
		expect(result.items).toEqual({ available: 3, byPrivateUsers: 3, byInstitutionsNative: 3, external: 3 });
		expect(Object.keys(result.loans).sort()).toEqual(
			['pending', 'accepted', 'rejected', 'active', 'return_requested', 'completed', 'aborted'].sort()
		);
		expect(result.loans.completed).toBe(3);
	});
});

describe('getMetricsHistory', () => {
	it('reads metrics_daily sorted by date, filtered to the requested window', async () => {
		const pb = fakePb();
		getSuperuserClient.mockResolvedValue(pb);

		await getMetricsHistory(30);

		expect(pb.collection).toHaveBeenCalledWith('metrics_daily');
		expect(pb.filter).toHaveBeenCalledWith('date >= {:cutoff}', {
			cutoff: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
		});
	});

	it('fails soft to [] instead of throwing — e.g. metrics_daily not migrated yet', async () => {
		const pb = fakePb();
		pb.collection = vi.fn(() => ({
			getList: vi.fn().mockResolvedValue({ totalItems: 0 }),
			getFullList: vi.fn().mockRejectedValue(new Error('Missing or invalid collection context.')),
		})) as unknown as typeof pb.collection;
		getSuperuserClient.mockResolvedValue(pb);

		await expect(getMetricsHistory(30)).resolves.toEqual([]);
	});
});

describe('getPublicStats', () => {
	it('returns only the whitelisted fields', async () => {
		const pb = fakePb();
		getSuperuserClient.mockResolvedValue(pb);

		const stats = await getPublicStats();

		expect(Object.keys(stats!).sort()).toEqual(
			[
				'usersTotal',
				'itemsTotal',
				'loansCompleted',
				'impactWouldBuyCount',
				'groupsTotal',
				'trustEdges',
				'messagesTotal',
				'activeUsers30d',
			].sort()
		);
	});

	it('counts items with owner.deleted != true, not status = "available" — tombstoned items from deleted accounts are hidden from every other item view and must not inflate this headline', async () => {
		const pb = fakePb();
		getSuperuserClient.mockResolvedValue(pb);

		await getPublicStats();

		const itemsCalls = pb.collection.mock.calls
			.map((call, i) => ({ name: call[0], getListCalls: pb.collection.mock.results[i].value.getList.mock.calls }))
			.filter((c) => c.name === 'items');
		expect(itemsCalls).toHaveLength(1);
		expect(itemsCalls[0].getListCalls[0][2]).toMatchObject({ filter: 'owner.deleted != true' });
	});

	it('reads the community/messages/activeUsers fields from the latest snapshot row — same source as /admin/metrics', async () => {
		const pb = fakePb();
		getSuperuserClient.mockResolvedValue(pb);

		const stats = await getPublicStats();

		expect(stats).toMatchObject({ groupsTotal: 7, trustEdges: 5, messagesTotal: 42, activeUsers30d: 4 });
	});

	it('defaults the snapshot-sourced fields to 0 when no metrics_daily row exists yet', async () => {
		const pb = fakePb();
		pb.collection = vi.fn((name: string) =>
			name === 'metrics_daily'
				? { getFirstListItem: vi.fn().mockRejectedValue(new Error('no rows')) }
				: { getList: vi.fn().mockResolvedValue({ totalItems: 3 }) }
		) as unknown as typeof pb.collection;
		getSuperuserClient.mockResolvedValue(pb);

		const stats = await getPublicStats();

		expect(stats).toMatchObject({ groupsTotal: 0, trustEdges: 0, messagesTotal: 0, activeUsers30d: 0 });
	});

	it('caches the result — a second call within the TTL does not re-query PocketBase', async () => {
		const pb = fakePb();
		getSuperuserClient.mockResolvedValue(pb);

		await getPublicStats();
		const callsAfterFirst = pb.collection.mock.calls.length;
		await getPublicStats();

		expect(pb.collection.mock.calls.length).toBe(callsAfterFirst);
	});

	it('fails soft to null instead of throwing — this now also renders on the home page', async () => {
		getSuperuserClient.mockRejectedValue(new Error('superuser auth failed'));

		await expect(getPublicStats()).resolves.toBeNull();
	});
});
