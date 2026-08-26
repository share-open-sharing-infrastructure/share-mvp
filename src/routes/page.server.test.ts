import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getPublicStats } = vi.hoisted(() => ({ getPublicStats: vi.fn() }));

vi.mock('$lib/server/metrics', () => ({ getPublicStats }));
vi.mock('$lib/instance', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/instance')>();
	return { ...actual, instance: { ...actual.instance, showLandingStats: true } };
});

import { instance } from '$lib/instance';
import { load } from './+page.server';

beforeEach(() => {
	vi.clearAllMocks();
	(instance as { showLandingStats: boolean }).showLandingStats = true;
});

describe('/ (landing page) load', () => {
	it('returns the public stats for the embedded widget', async () => {
		const stats = { usersTotal: 10, itemsTotal: 5, loansCompleted: 2, impactWouldBuyCount: 1 };
		getPublicStats.mockResolvedValue(stats);

		const result = await load({} as never);

		expect(result).toEqual({ stats });
	});

	it('returns stats: null when getPublicStats fails soft — the widget is simply omitted', async () => {
		getPublicStats.mockResolvedValue(null);

		const result = await load({} as never);

		expect(result).toEqual({ stats: null });
	});

	it('returns stats: null without calling getPublicStats when showLandingStats is disabled', async () => {
		(instance as { showLandingStats: boolean }).showLandingStats = false;

		const result = await load({} as never);

		expect(result).toEqual({ stats: null });
		expect(getPublicStats).not.toHaveBeenCalled();
	});
});
