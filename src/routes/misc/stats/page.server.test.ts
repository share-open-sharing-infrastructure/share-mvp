import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getPublicStats } = vi.hoisted(() => ({ getPublicStats: vi.fn() }));

vi.mock('$lib/server/metrics', () => ({ getPublicStats }));

import { load } from './+page.server';

beforeEach(() => {
	vi.clearAllMocks();
});

describe('/misc/stats load', () => {
	it('returns the whitelisted public stats, unauthenticated', async () => {
		const stats = { usersTotal: 10, itemsAvailable: 5, loansCompleted: 2, impactWouldBuyCount: 1 };
		getPublicStats.mockResolvedValue(stats);

		const result = await load({} as never);

		expect(result).toEqual({ stats });
	});

	it('returns stats: null when getPublicStats fails soft (page shows a fallback message)', async () => {
		getPublicStats.mockResolvedValue(null);

		const result = await load({} as never);

		expect(result).toEqual({ stats: null });
	});
});
