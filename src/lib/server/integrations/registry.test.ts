import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SyncSummary } from './core/types';

const { syncAllMock } = vi.hoisted(() => ({ syncAllMock: vi.fn() }));

vi.mock('./leihbackend', () => ({
	leihbackendIntegration: { id: 'leihbackend', syncAll: syncAllMock },
}));

import { runAllIntegrations, pullIntegrations } from './registry';

const pb = {} as never;

function summary(name: string): SyncSummary {
	return {
		institution: name,
		fetched: 0,
		created: 0,
		updated: 0,
		archived: 0,
		skipped: 0,
		errors: [],
		durationMs: 0,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('pullIntegrations', () => {
	it('registers the leihbackend integration', () => {
		expect(pullIntegrations.map((i) => i.id)).toContain('leihbackend');
	});
});

describe('runAllIntegrations', () => {
	it("flattens each integration's per-institution summaries", async () => {
		syncAllMock.mockResolvedValue([summary('commons-zentrum'), summary('mosaique')]);

		const summaries = await runAllIntegrations(pb);

		expect(syncAllMock).toHaveBeenCalledWith(pb);
		expect(summaries.map((s) => s.institution)).toEqual(['commons-zentrum', 'mosaique']);
	});

	it('isolates a throwing integration into a single error summary', async () => {
		syncAllMock.mockRejectedValue(new Error('discovery failed'));

		const summaries = await runAllIntegrations(pb);

		expect(summaries).toHaveLength(1);
		expect(summaries[0].institution).toBe('(leihbackend)');
		expect(summaries[0].errors.length).toBeGreaterThan(0);
	});
});
