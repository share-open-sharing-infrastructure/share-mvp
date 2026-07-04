import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncInstitution, syncInstitutions, makeSummary } from './sync';
import type { ExistingItem, Institution, MappedItem } from './types';

function mappedItem(externalId: string, overrides: Partial<MappedItem> = {}): MappedItem {
	return {
		externalId,
		name: `Item ${externalId}`,
		description: 'desc',
		status: 'available',
		categories: [],
		externalImgUrl: '',
		externalUrl: '',
		place: 'Lüneburg',
		owner: 'inst1',
		trusteesOnly: false,
		...overrides,
	};
}

function existingFrom(item: MappedItem): ExistingItem {
	return {
		id: `pb-${item.externalId}`,
		externalId: item.externalId,
		name: item.name,
		description: item.description,
		status: item.status,
		categories: item.categories,
		externalImgUrl: item.externalImgUrl,
		externalUrl: item.externalUrl,
		place: item.place,
	};
}

interface BatchCall {
	method: 'create' | 'update';
	args: unknown[];
}

function makeMockPb(existing: ExistingItem[] = [], opts: { failLoad?: boolean } = {}) {
	const batchCalls: BatchCall[] = [];
	const batch = {
		collection: () => ({
			create: (data: unknown) => batchCalls.push({ method: 'create', args: [data] }),
			update: (...args: unknown[]) => batchCalls.push({ method: 'update', args }),
		}),
		send: vi.fn().mockResolvedValue(undefined),
	};
	const getFullList = opts.failLoad
		? vi.fn().mockRejectedValue(new Error('db down'))
		: vi.fn().mockResolvedValue(existing);
	const pb = {
		collection: vi.fn((name: string) => {
			if (name === 'items') return { getFullList };
			throw new Error(`unexpected collection: ${name}`);
		}),
		createBatch: vi.fn(() => batch),
		// Mirror pocketbase's filter binding: substitute {:key} with the quoted param.
		filter: vi.fn((expr: string, params: Record<string, string>) =>
			expr.replace(/\{:(\w+)\}/g, (_, key) => `"${params[key]}"`)
		),
	};
	return { pb: pb as never, batchCalls, getFullList };
}

const institution: Institution = { id: 'inst1', username: 'commons-zentrum', city: 'Lüneburg' };

beforeEach(() => {
	vi.clearAllMocks();
});

describe('syncInstitution', () => {
	it('creates items with no existing match', async () => {
		const { pb, batchCalls } = makeMockPb([]);
		const fetchItems = vi.fn().mockResolvedValue([mappedItem('rec1')]);

		const summary = await syncInstitution(pb, institution, fetchItems);

		expect(summary.fetched).toBe(1);
		expect(summary.created).toBe(1);
		expect(summary.updated).toBe(0);
		expect(summary.archived).toBe(0);
		expect(batchCalls).toHaveLength(1);
		expect(batchCalls[0].method).toBe('create');
		expect((batchCalls[0].args[0] as MappedItem).externalId).toBe('rec1');
	});

	it('skips items with no changes', async () => {
		const item = mappedItem('rec1');
		const { pb, batchCalls } = makeMockPb([existingFrom(item)]);
		const fetchItems = vi.fn().mockResolvedValue([item]);

		const summary = await syncInstitution(pb, institution, fetchItems);

		expect(summary.skipped).toBe(1);
		expect(summary.updated).toBe(0);
		expect(batchCalls).toHaveLength(0);
	});

	it('makes zero writes and records an error when fetchItems fails', async () => {
		const { pb, batchCalls, getFullList } = makeMockPb([]);
		const fetchItems = vi.fn().mockRejectedValue(new Error('feed down'));

		const summary = await syncInstitution(pb, institution, fetchItems);

		expect(summary.fetched).toBe(0);
		expect(summary.created).toBe(0);
		expect(summary.errors.length).toBeGreaterThan(0);
		expect(getFullList).not.toHaveBeenCalled();
		expect(batchCalls).toHaveLength(0);
	});

	it('makes zero writes and records an error when the DB load fails', async () => {
		const { pb, batchCalls } = makeMockPb([], { failLoad: true });
		const fetchItems = vi.fn().mockResolvedValue([mappedItem('rec1')]);

		const summary = await syncInstitution(pb, institution, fetchItems);

		expect(summary.fetched).toBe(1);
		expect(summary.errors.length).toBeGreaterThan(0);
		expect(batchCalls).toHaveLength(0);
	});

	it('archives a small minority of vanished items normally', async () => {
		const kept = [mappedItem('rec1'), mappedItem('rec2'), mappedItem('rec3')];
		const gone = mappedItem('rec4');
		const { pb, batchCalls } = makeMockPb([...kept, gone].map(existingFrom));
		const fetchItems = vi.fn().mockResolvedValue(kept);

		const summary = await syncInstitution(pb, institution, fetchItems);

		expect(summary.archived).toBe(1);
		expect(summary.errors).toHaveLength(0);
		expect(batchCalls.filter((c) => c.method === 'update')).toHaveLength(1);
	});

	it('skips the archive phase and records an error when the feed is empty but items exist', async () => {
		const existing = [mappedItem('rec1'), mappedItem('rec2')].map(existingFrom);
		const { pb, batchCalls } = makeMockPb(existing);
		const fetchItems = vi.fn().mockResolvedValue([]);

		const summary = await syncInstitution(pb, institution, fetchItems);

		expect(summary.archived).toBe(0);
		expect(batchCalls).toHaveLength(0);
		expect(summary.errors.some((e) => e.includes('Archive phase skipped'))).toBe(true);
	});

	it('applies creates/updates but skips archiving when most stored items would be archived', async () => {
		const kept = mappedItem('rec1');
		const vanished = [mappedItem('rec2'), mappedItem('rec3')];
		const { pb, batchCalls } = makeMockPb([kept, ...vanished].map(existingFrom));
		// rec1 changed (still present), rec4 is new; rec2+rec3 vanished → 2/3 ≥ 50%.
		const fetchItems = vi.fn().mockResolvedValue([
			mappedItem('rec1', { status: 'unavailable' }),
			mappedItem('rec4'),
		]);

		const summary = await syncInstitution(pb, institution, fetchItems);

		expect(summary.created).toBe(1);
		expect(summary.updated).toBe(1);
		expect(summary.archived).toBe(0);
		expect(summary.errors.some((e) => e.includes('Archive phase skipped'))).toBe(true);
		// Only the rec1 update and rec4 create hit the batch — no archive updates.
		expect(batchCalls).toHaveLength(2);
	});

	it('applies the injected retry wrapper to the DB load', async () => {
		const { pb } = makeMockPb([]);
		const fetchItems = vi.fn().mockResolvedValue([]);
		const retry = vi.fn((op) => op());

		await syncInstitution(pb, institution, fetchItems, retry);

		expect(retry).toHaveBeenCalled();
	});
});

describe('syncInstitutions', () => {
	it("isolates one institution's failure from the next", async () => {
		const institutionB: Institution = { ...institution, id: 'inst2', username: 'mosaique' };
		const { pb } = makeMockPb([]);
		const fetchItems = vi
			.fn()
			.mockRejectedValueOnce(new Error('down'))
			.mockResolvedValueOnce([mappedItem('rec1')]);

		const summaries = await syncInstitutions(pb, [institution, institutionB], fetchItems);

		expect(summaries).toHaveLength(2);
		expect(summaries[0].institution).toBe('commons-zentrum');
		expect(summaries[0].errors.length).toBeGreaterThan(0);
		expect(summaries[1].institution).toBe('mosaique');
		expect(summaries[1].errors).toHaveLength(0);
		expect(summaries[1].created).toBe(1);
	});
});

describe('makeSummary', () => {
	it('returns a zeroed summary with the given context name and errors', () => {
		expect(makeSummary('ctx', ['boom'])).toEqual({
			institution: 'ctx',
			fetched: 0,
			created: 0,
			updated: 0,
			archived: 0,
			skipped: 0,
			errors: ['boom'],
			durationMs: 0,
		});
	});
});
