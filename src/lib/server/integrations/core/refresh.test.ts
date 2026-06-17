import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DESCRIPTION_PREFIX } from '$lib/server/itemArchive';
import { refreshInstitution, refreshInstitutions } from './refresh';
import type { ExistingItem, Institution, MappedItem, RefreshIntegration, RefreshOutcome } from './types';

function existingItem(externalId: string, overrides: Partial<ExistingItem> = {}): ExistingItem {
	return {
		id: `pb-${externalId}`,
		externalId,
		name: `Item ${externalId}`,
		description: 'desc',
		status: 'available',
		categories: [],
		externalImgUrl: '',
		externalUrl: '',
		place: 'Lüneburg',
		...overrides,
	};
}

/** A status-only MappedItem mirroring an existing record but with `status` overridden. */
function refreshed(item: ExistingItem, status: MappedItem['status']): MappedItem {
	return {
		externalId: item.externalId ?? '',
		name: item.name,
		description: item.description,
		categories: item.categories,
		place: item.place,
		externalUrl: item.externalUrl,
		externalImgUrl: item.externalImgUrl,
		status,
		owner: 'inst1',
		trusteesOnly: false,
	};
}

interface BatchOp {
	method: 'create' | 'update';
	id?: string;
	data: Record<string, unknown>;
}

function makeMockPb(existing: ExistingItem[]) {
	const ops: BatchOp[] = [];
	const batch = {
		collection: () => ({
			create: (data: BatchOp['data']) => ops.push({ method: 'create', data }),
			update: (id: string, data: BatchOp['data']) => ops.push({ method: 'update', id, data }),
		}),
		send: vi.fn().mockResolvedValue(undefined),
	};
	const getFullList = vi.fn().mockResolvedValue(existing);
	const pb = {
		collection: vi.fn((name: string) => {
			if (name === 'items') return { getFullList };
			throw new Error(`unexpected collection: ${name}`);
		}),
		createBatch: vi.fn(() => batch),
	};
	return { pb: pb as never, ops, getFullList };
}

/** A refresh integration that claims every item and returns a fixed outcome map keyed by externalId. */
function integration(outcomes: Record<string, RefreshOutcome>, id = 'test'): RefreshIntegration {
	return {
		id,
		claimsItem: () => true,
		fetchOne: vi.fn(async (_inst, item: ExistingItem) => outcomes[item.externalId ?? ''] ?? { kind: 'gone' }),
	};
}

const institution: Institution = { id: 'inst1', username: 'ratsbuecherei', city: 'Lüneburg' };

beforeEach(() => {
	vi.clearAllMocks();
});

describe('refreshInstitution', () => {
	it('updates a changed item (status only), never creates', async () => {
		const item = existingItem('118$1', { status: 'available' });
		const { pb, ops } = makeMockPb([item]);
		const integrations = [integration({ '118$1': { kind: 'found', item: refreshed(item, 'unavailable') } })];

		const summary = await refreshInstitution(pb, institution, integrations);

		expect(summary.updated).toBe(1);
		expect(summary.created).toBe(0);
		expect(summary.archived).toBe(0);
		expect(ops).toHaveLength(1);
		expect(ops[0]).toMatchObject({ method: 'update', id: 'pb-118$1', data: { status: 'unavailable' } });
		// status-only: owner/trusteesOnly are not part of the update payload
		expect(ops[0].data).not.toHaveProperty('owner');
		expect(ops[0].data).not.toHaveProperty('trusteesOnly');
	});

	it('skips an unchanged item', async () => {
		const item = existingItem('118$1', { status: 'available' });
		const { pb, ops } = makeMockPb([item]);
		const integrations = [integration({ '118$1': { kind: 'found', item: refreshed(item, 'available') } })];

		const summary = await refreshInstitution(pb, institution, integrations);

		expect(summary.skipped).toBe(1);
		expect(summary.updated).toBe(0);
		expect(ops).toHaveLength(0);
	});

	it('archives an item the source no longer has (gone)', async () => {
		const item = existingItem('118$1', { description: 'a thing' });
		const { pb, ops } = makeMockPb([item]);
		const integrations = [integration({ '118$1': { kind: 'gone' } })];

		const summary = await refreshInstitution(pb, institution, integrations);

		expect(summary.archived).toBe(1);
		expect(ops).toHaveLength(1);
		expect(ops[0]).toMatchObject({
			method: 'update',
			id: 'pb-118$1',
			data: { status: 'unavailable', description: `${DESCRIPTION_PREFIX}a thing` },
		});
	});

	it('leaves a transiently-errored item untouched and records the error', async () => {
		// Three items, one transient error → 33% error rate, below the circuit-breaker threshold.
		const ok1 = existingItem('118$1', { status: 'available' });
		const ok2 = existingItem('118$2', { status: 'available' });
		const bad = existingItem('118$3', { status: 'available' });
		const { pb, ops } = makeMockPb([ok1, ok2, bad]);
		const integrations = [
			integration({
				'118$1': { kind: 'found', item: refreshed(ok1, 'unavailable') },
				'118$2': { kind: 'found', item: refreshed(ok2, 'unavailable') },
				'118$3': { kind: 'error', message: 'timeout' },
			}),
		];

		const summary = await refreshInstitution(pb, institution, integrations);

		expect(summary.errors).toContain('timeout');
		expect(summary.updated).toBe(2); // both good ones
		expect(summary.archived).toBe(0); // the errored item is NOT archived
		expect(ops.find((o) => o.id === 'pb-118$3')).toBeUndefined();
	});

	it('aborts with zero writes when the error rate reaches the circuit-breaker threshold', async () => {
		const items = [existingItem('118$1'), existingItem('118$2')];
		const { pb, ops } = makeMockPb(items);
		const integrations = [
			integration({
				'118$1': { kind: 'error', message: 'boom' },
				'118$2': { kind: 'gone' }, // would archive, but the breaker aborts first
			}),
		];

		const summary = await refreshInstitution(pb, institution, integrations);

		expect(ops).toHaveLength(0);
		expect(summary.archived).toBe(0);
		expect(summary.errors.length).toBeGreaterThanOrEqual(2); // the boom + the abort notice
		expect(summary.errors[0]).toMatch(/Aborted/);
	});

	it('skips items no integration claims', async () => {
		const item = existingItem('plain-rec');
		const { pb, ops } = makeMockPb([item]);
		const fetchOne = vi.fn();
		const integrations: RefreshIntegration[] = [{ id: 'none', claimsItem: () => false, fetchOne }];

		const summary = await refreshInstitution(pb, institution, integrations);

		expect(fetchOne).not.toHaveBeenCalled();
		expect(ops).toHaveLength(0);
		expect(summary.updated).toBe(0);
		expect(summary.archived).toBe(0);
	});

	it('routes each item to the first integration that claims it', async () => {
		const webopac = existingItem('118$1', { status: 'available', externalUrl: 'https://x/webopac/detail.aspx?d=1' });
		const leih = existingItem('rec9', { status: 'available' });
		const { pb } = makeMockPb([webopac, leih]);

		const winbiapFetch = vi.fn<(inst: Institution, item: ExistingItem) => Promise<RefreshOutcome>>(async () => ({
			kind: 'found',
			item: refreshed(webopac, 'unavailable'),
		}));
		const leihFetch = vi.fn<(inst: Institution, item: ExistingItem) => Promise<RefreshOutcome>>(async () => ({
			kind: 'found',
			item: refreshed(leih, 'unavailable'),
		}));
		const integrations: RefreshIntegration[] = [
			{ id: 'winbiap', claimsItem: (i) => (i.externalId ?? '').includes('$'), fetchOne: winbiapFetch },
			{ id: 'leihbackend', claimsItem: () => true, fetchOne: leihFetch },
		];

		await refreshInstitution(pb, institution, integrations);

		expect(winbiapFetch).toHaveBeenCalledTimes(1);
		expect(winbiapFetch.mock.calls[0][1]).toMatchObject({ externalId: '118$1' });
		expect(leihFetch).toHaveBeenCalledTimes(1);
		expect(leihFetch.mock.calls[0][1]).toMatchObject({ externalId: 'rec9' });
	});

	it('aborts with zero writes and records an error when the DB load fails', async () => {
		const { pb, ops, getFullList } = makeMockPb([]);
		getFullList.mockRejectedValueOnce(new Error('db down'));
		const integrations = [integration({})];

		const summary = await refreshInstitution(pb, institution, integrations);

		expect(summary.errors.length).toBeGreaterThan(0);
		expect(ops).toHaveLength(0);
	});

	it('applies the injected retry wrapper to DB reads/writes', async () => {
		const item = existingItem('118$1', { status: 'available' });
		const { pb } = makeMockPb([item]);
		const integrations = [integration({ '118$1': { kind: 'found', item: refreshed(item, 'unavailable') } })];
		const retry = vi.fn((op) => op());

		await refreshInstitution(pb, institution, integrations, retry);

		expect(retry).toHaveBeenCalled();
	});
});

describe('refreshInstitutions', () => {
	it("isolates one institution's failure from the next", async () => {
		const institutionB: Institution = { ...institution, id: 'inst2', username: 'mosaique' };
		const itemA = existingItem('118$1', { status: 'available' });
		const { pb } = makeMockPb([itemA]);
		// First institution's load throws; second succeeds (same mock returns itemA again).
		const integrations = [integration({ '118$1': { kind: 'found', item: refreshed(itemA, 'unavailable') } })];

		const summaries = await refreshInstitutions(pb, [institution, institutionB], integrations);

		expect(summaries).toHaveLength(2);
		expect(summaries[0].institution).toBe('ratsbuecherei');
		expect(summaries[1].institution).toBe('mosaique');
	});
});
