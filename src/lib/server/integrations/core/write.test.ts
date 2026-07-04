import { describe, it, expect, vi, afterEach } from 'vitest';
import { DESCRIPTION_PREFIX } from '$lib/server/itemArchive';
import { applyDiff } from './write';
import type { DiffResult, ExistingItem, MappedItem, RetryWrapper } from './types';

function mappedItem(externalId: string): MappedItem {
	return {
		externalId,
		name: `Item ${externalId}`,
		description: 'desc',
		status: 'available',
		categories: [],
		externalImgUrl: '',
		externalUrl: '',
		place: '',
		owner: 'inst1',
		trusteesOnly: false,
	};
}

function existingItem(id: string, externalId: string): ExistingItem {
	return {
		id,
		externalId,
		name: `Item ${externalId}`,
		description: 'old',
		status: 'available',
		categories: [],
		externalImgUrl: '',
		externalUrl: '',
		place: '',
	};
}

interface BatchOp {
	method: 'create' | 'update';
	id?: string;
	data: unknown;
}

/** Mock PocketBase whose `createBatch` records ops; `sendImpl(batchIndex)` decides each batch's fate. */
function makeMockPb(sendImpl: (batchIndex: number) => Promise<void> = () => Promise.resolve()) {
	const batches: BatchOp[][] = [];
	const pb = {
		createBatch: vi.fn(() => {
			const ops: BatchOp[] = [];
			const index = batches.length;
			batches.push(ops);
			return {
				collection: () => ({
					create: (data: unknown) => ops.push({ method: 'create', data }),
					update: (id: string, data: unknown) => ops.push({ method: 'update', id, data }),
				}),
				send: () => sendImpl(index),
			};
		}),
	};
	return { pb: pb as never, batches };
}

const emptyDiff = (): DiffResult => ({ toCreate: [], toUpdate: [], toArchive: [], skipped: 0 });

afterEach(() => {
	vi.useRealTimers();
});

describe('applyDiff', () => {
	it('writes creates, updates, and archives with correct counts', async () => {
		const { pb, batches } = makeMockPb();
		const diff: DiffResult = {
			...emptyDiff(),
			toCreate: [mappedItem('c1')],
			toUpdate: [{ id: 'u1', data: mappedItem('rec-u1') }],
			toArchive: [existingItem('a1', 'rec-a1')],
		};

		const result = await applyDiff(pb, diff);

		expect(result).toEqual({ created: 1, updated: 1, archived: 1, errors: [] });
		// one batch per non-empty phase (update, create, archive)
		expect(batches).toHaveLength(3);
		const archiveOp = batches.flat().find((o) => o.id === 'a1');
		expect(archiveOp?.data).toMatchObject({
			status: 'unavailable',
			description: `${DESCRIPTION_PREFIX}old`,
		});
	});

	it('writes only synced content fields on update — never owner/trusteesOnly', async () => {
		const { pb, batches } = makeMockPb();
		const diff: DiffResult = { ...emptyDiff(), toUpdate: [{ id: 'u1', data: mappedItem('rec-u1') }] };

		await applyDiff(pb, diff);

		const updateOp = batches.flat().find((o) => o.id === 'u1');
		expect(updateOp?.data).toMatchObject({ name: 'Item rec-u1', status: 'available' });
		expect(updateOp?.data).not.toHaveProperty('owner');
		expect(updateOp?.data).not.toHaveProperty('trusteesOnly');
		expect(updateOp?.data).not.toHaveProperty('externalId');
	});

	it('splits a phase into multiple batches beyond the batch size', async () => {
		vi.useFakeTimers();
		const { pb, batches } = makeMockPb();
		const diff: DiffResult = { ...emptyDiff(), toCreate: Array.from({ length: 16 }, (_, i) => mappedItem(`c${i}`)) };

		const promise = applyDiff(pb, diff);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result.created).toBe(16);
		expect(batches).toHaveLength(2); // CREATE_BATCH = 15 → 15 + 1
		expect(batches[0]).toHaveLength(15);
		expect(batches[1]).toHaveLength(1);
	});

	it('records an error for a failed batch without aborting other phases', async () => {
		// Fail the first batch (the update phase), let the rest succeed.
		const { pb } = makeMockPb((index) => (index === 0 ? Promise.reject(new Error('boom')) : Promise.resolve()));
		const diff: DiffResult = {
			...emptyDiff(),
			toUpdate: [{ id: 'u1', data: mappedItem('rec-u1') }],
			toCreate: [mappedItem('c1')],
		};

		const result = await applyDiff(pb, diff);

		expect(result.updated).toBe(0);
		expect(result.created).toBe(1);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('update batch:');
	});

	it('honors the injected retry wrapper for every batch send', async () => {
		const { pb } = makeMockPb();
		const retry: RetryWrapper = vi.fn((op) => op());
		const diff: DiffResult = {
			...emptyDiff(),
			toCreate: [mappedItem('c1')],
			toUpdate: [{ id: 'u1', data: mappedItem('rec-u1') }],
		};

		await applyDiff(pb, diff, retry);

		expect(retry).toHaveBeenCalledTimes(2); // one per non-empty phase
	});

	it('lets the retry wrapper recover a failed send', async () => {
		let attempts = 0;
		const { pb } = makeMockPb(() => {
			attempts += 1;
			return attempts === 1 ? Promise.reject({ status: 401 }) : Promise.resolve();
		});
		const retry: RetryWrapper = async (op) => {
			try {
				return await op();
			} catch {
				return await op(); // retry once
			}
		};
		const diff: DiffResult = { ...emptyDiff(), toUpdate: [{ id: 'u1', data: mappedItem('rec-u1') }] };

		const result = await applyDiff(pb, diff, retry);

		expect(result.updated).toBe(1);
		expect(result.errors).toHaveLength(0);
		expect(attempts).toBe(2);
	});
});
