import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SyncSummary } from './core/types';

const { syncAllMock, findInstitutionsMock, leihbackendRefreshFetch, winbiapRefreshFetch } = vi.hoisted(() => ({
	syncAllMock: vi.fn(),
	findInstitutionsMock: vi.fn(),
	leihbackendRefreshFetch: vi.fn(),
	winbiapRefreshFetch: vi.fn(),
}));

vi.mock('./leihbackend', () => ({
	leihbackendIntegration: { id: 'leihbackend', syncAll: syncAllMock },
	leihbackendRefreshIntegration: { id: 'leihbackend', claimsItem: () => true, fetchOne: leihbackendRefreshFetch },
}));

vi.mock('./winbiap', () => ({
	winbiapRefreshIntegration: {
		id: 'winbiap',
		claimsItem: (item: { externalId?: string }) => (item.externalId ?? '').includes('$'),
		fetchOne: winbiapRefreshFetch,
	},
}));

vi.mock('./core/pocketbase', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./core/pocketbase')>();
	return { ...actual, findSyncInstitutions: findInstitutionsMock };
});

import { runAllIntegrations, refreshAllIntegrations, pullIntegrations, refreshIntegrations } from './registry';

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

describe('refreshIntegrations', () => {
	it('registers winbiap before leihbackend (catch-all last)', () => {
		expect(refreshIntegrations.map((i) => i.id)).toEqual(['winbiap', 'leihbackend']);
	});
});

describe('refreshAllIntegrations', () => {
	it('discovers institutions once and refreshes each, routing items by claimsItem', async () => {
		findInstitutionsMock.mockResolvedValue([
			{ id: 'inst1', username: 'ratsbuecherei', leihbackendUrl: 'https://x/webopac' },
		]);
		// One WINBIAP item ($) and one leihbackend item; both report unchanged.
		const items = [
			{ id: 'p1', externalId: '118$1', name: 'a', description: '', status: 'available', categories: [], externalImgUrl: '', externalUrl: '', place: '' },
			{ id: 'p2', externalId: 'rec9', name: 'b', description: '', status: 'available', categories: [], externalImgUrl: '', externalUrl: '', place: '' },
		];
		const pbWithItems = {
			collection: () => ({ getFullList: vi.fn().mockResolvedValue(items) }),
			createBatch: () => ({ collection: () => ({ update: vi.fn(), create: vi.fn() }), send: vi.fn() }),
		} as never;
		winbiapRefreshFetch.mockResolvedValue({ kind: 'gone' });
		leihbackendRefreshFetch.mockResolvedValue({ kind: 'gone' });

		const summaries = await refreshAllIntegrations(pbWithItems);

		expect(findInstitutionsMock).toHaveBeenCalledTimes(1);
		expect(summaries).toHaveLength(1);
		expect(winbiapRefreshFetch).toHaveBeenCalledTimes(1); // the 118$1 item
		expect(leihbackendRefreshFetch).toHaveBeenCalledTimes(1); // the rec9 item
	});

	it('forwards a given institution id to discovery', async () => {
		findInstitutionsMock.mockResolvedValue([]);

		await refreshAllIntegrations(pb, 'inst42');

		expect(findInstitutionsMock).toHaveBeenCalledWith(pb, 'inst42');
	});

	it('returns a single error summary (zero writes) for an unknown institution id', async () => {
		findInstitutionsMock.mockResolvedValue([]);

		const summaries = await refreshAllIntegrations(pb, 'bogus');

		expect(summaries).toHaveLength(1);
		expect(summaries[0].institution).toBe('(bogus)');
		expect(summaries[0].errors.length).toBeGreaterThan(0);
		expect(winbiapRefreshFetch).not.toHaveBeenCalled();
		expect(leihbackendRefreshFetch).not.toHaveBeenCalled();
	});
});
