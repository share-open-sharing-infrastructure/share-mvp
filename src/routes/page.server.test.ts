import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getPublicStats } = vi.hoisted(() => ({ getPublicStats: vi.fn() }));

vi.mock('$lib/server/metrics', () => ({ getPublicStats }));
// Hermetic default env: mocked so a local `.env` (which may set PUBLIC_SHOW_LANDING_STATS for
// dev) can never decide whether the teaser is on — same rationale as instance.test.ts:3-5.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

import { load } from './+page.server';

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.doUnmock('$env/dynamic/public');
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
		vi.resetModules();
		vi.doMock('$env/dynamic/public', () => ({
			env: { PUBLIC_SHOW_LANDING_STATS: 'false' },
		}));
		const { load: loadDisabled } = await import('./+page.server');

		const result = await loadDisabled({} as never);

		expect(result).toEqual({ stats: null });
		expect(getPublicStats).not.toHaveBeenCalled();
	});
});
