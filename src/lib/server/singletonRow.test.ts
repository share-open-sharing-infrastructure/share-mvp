import { describe, it, expect, vi } from 'vitest';
import { makeMockPb } from '$lib/test-utils/pocketbase';
import { upsertSingletonRow } from './singletonRow';

const COLLECTION = 'user_things';

function run(opts: {
	find: ReturnType<typeof vi.fn>;
	create?: ReturnType<typeof vi.fn>;
	update?: ReturnType<typeof vi.fn>;
}) {
	const create = opts.create ?? vi.fn().mockResolvedValue({ id: 'new' });
	const update = opts.update ?? vi.fn().mockResolvedValue({ id: 'row1' });
	const pb = makeMockPb({ [COLLECTION]: { create, update } });
	const promise = upsertSingletonRow({
		pb,
		collection: COLLECTION,
		find: opts.find as () => Promise<{ id: string } | null>,
		createData: { user: 'u1', value: 42 },
		patch: { value: 42 },
	});
	return { promise, create, update };
}

describe('upsertSingletonRow', () => {
	it('updates the existing row with the patch (not the full create data)', async () => {
		const find = vi.fn().mockResolvedValue({ id: 'row1' });
		const { promise, create, update } = run({ find });
		await promise;
		expect(update).toHaveBeenCalledWith('row1', { value: 42 });
		expect(create).not.toHaveBeenCalled();
	});

	it('creates the row when none exists', async () => {
		const find = vi.fn().mockResolvedValue(null);
		const { promise, create, update } = run({ find });
		await promise;
		expect(create).toHaveBeenCalledWith({ user: 'u1', value: 42 });
		expect(update).not.toHaveBeenCalled();
	});

	it('retries a lost create race as an update (unique-index loser)', async () => {
		// find: null up front, then the row the concurrent writer just created.
		const find = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'row1' });
		const create = vi.fn().mockRejectedValue(new Error('unique constraint'));
		const { promise, update } = run({ find, create });
		await expect(promise).resolves.toBeUndefined();
		expect(update).toHaveBeenCalledWith('row1', { value: 42 });
	});

	it('rethrows a genuine create error when no row exists afterwards', async () => {
		const find = vi.fn().mockResolvedValue(null);
		const create = vi.fn().mockRejectedValue(new Error('boom'));
		const { promise, update } = run({ find, create });
		await expect(promise).rejects.toThrow('boom');
		expect(update).not.toHaveBeenCalled();
	});
});
