import { describe, it, expect, vi, beforeEach } from 'vitest';

const { isAdmin, getLiveCoreMetrics, getMetricsHistory } = vi.hoisted(() => ({
	isAdmin: vi.fn(),
	getLiveCoreMetrics: vi.fn(),
	getMetricsHistory: vi.fn(),
}));

vi.mock('$lib/server/metrics', () => ({ isAdmin, getLiveCoreMetrics, getMetricsHistory }));

import { load } from './+page.server';

type LoadEvent = Parameters<typeof load>[0];

beforeEach(() => {
	vi.clearAllMocks();
});

describe('/admin/metrics load', () => {
	it('404s a non-admin user — the route must not reveal its existence', async () => {
		isAdmin.mockResolvedValue(false);

		await expect(load({ locals: { user: { id: 'u1' } } } as LoadEvent)).rejects.toMatchObject({
			status: 404,
		});
		expect(isAdmin).toHaveBeenCalledWith('u1');
		expect(getLiveCoreMetrics).not.toHaveBeenCalled();
	});

	it('404s an unauthenticated visitor', async () => {
		isAdmin.mockResolvedValue(false);

		await expect(load({ locals: { user: null } } as LoadEvent)).rejects.toMatchObject({ status: 404 });
		expect(isAdmin).toHaveBeenCalledWith(undefined);
	});

	it('returns live metrics + history for an admin', async () => {
		isAdmin.mockResolvedValue(true);
		const live = { users: { total: 1, institutions: 0, verified: 1 } };
		const history = [{ date: '2026-07-20', metrics: {} }];
		getLiveCoreMetrics.mockResolvedValue(live);
		getMetricsHistory.mockResolvedValue(history);

		const result = await load({ locals: { user: { id: 'admin1' } } } as LoadEvent);

		expect(result).toEqual({ live, history });
	});
});
