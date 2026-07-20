import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSuperuserClient } = vi.hoisted(() => ({ getSuperuserClient: vi.fn() }));

vi.mock('$env/static/private', () => ({
	ADMIN_EMAILS: '  Alice@Example.com, bob@example.com  ',
}));
vi.mock('$lib/server/integrations/core/pocketbase', () => ({ getSuperuserClient }));

import {
	isAdmin,
	getLiveCoreMetrics,
	getMetricsHistory,
	getPublicStats,
	_resetPublicStatsCacheForTests,
} from './metrics';

function fakePb(getListImpl?: () => Promise<{ totalItems: number }>) {
	return {
		filter: vi.fn((raw: string) => raw),
		collection: vi.fn(() => ({
			getList: vi.fn(getListImpl ?? (() => Promise.resolve({ totalItems: 3 }))),
			getFullList: vi.fn().mockResolvedValue([]),
		})),
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	_resetPublicStatsCacheForTests();
});

describe('isAdmin', () => {
	it('matches an allowlisted email case- and whitespace-insensitively', () => {
		expect(isAdmin({ email: 'alice@example.com' })).toBe(true);
		expect(isAdmin({ email: '  BOB@EXAMPLE.COM  ' })).toBe(true);
	});

	it('rejects an email not on the allowlist', () => {
		expect(isAdmin({ email: 'carol@example.com' })).toBe(false);
	});

	it('rejects a missing user or missing email', () => {
		expect(isAdmin(null)).toBe(false);
		expect(isAdmin(undefined)).toBe(false);
		expect(isAdmin({})).toBe(false);
	});

	it('disables the dashboard for everyone when ADMIN_EMAILS is unset', async () => {
		vi.resetModules();
		vi.doMock('$env/static/private', () => ({ ADMIN_EMAILS: '' }));
		vi.doMock('$lib/server/integrations/core/pocketbase', () => ({ getSuperuserClient }));
		const fresh = await import('./metrics');
		expect(fresh.isAdmin({ email: 'alice@example.com' })).toBe(false);
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
});

describe('getPublicStats', () => {
	it('returns only the whitelisted fields', async () => {
		const pb = fakePb();
		getSuperuserClient.mockResolvedValue(pb);

		const stats = await getPublicStats();

		expect(Object.keys(stats).sort()).toEqual(
			['usersTotal', 'itemsAvailable', 'loansCompleted', 'impactWouldBuyCount'].sort()
		);
	});

	it('caches the result — a second call within the TTL does not re-query PocketBase', async () => {
		const pb = fakePb();
		getSuperuserClient.mockResolvedValue(pb);

		await getPublicStats();
		const callsAfterFirst = pb.collection.mock.calls.length;
		await getPublicStats();

		expect(pb.collection.mock.calls.length).toBe(callsAfterFirst);
	});
});
