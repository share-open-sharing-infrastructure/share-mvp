import { describe, it, expect, vi } from 'vitest';
import { makeMockPb } from '$lib/test-utils/pocketbase';
import { deleteSingletonRow, upsertSingletonRow } from './singletonRow';

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

/** A PocketBase-shaped rejection: what matters to the guard is the `status` field. */
function pbError(status: number, message = `status ${status}`) {
	return Object.assign(new Error(message), { status });
}

function runDelete(opts: { find: ReturnType<typeof vi.fn>; del?: ReturnType<typeof vi.fn> }) {
	const del = opts.del ?? vi.fn().mockResolvedValue(true);
	const pb = makeMockPb({ [COLLECTION]: { delete: del } });
	const promise = deleteSingletonRow({
		pb,
		collection: COLLECTION,
		find: opts.find as () => Promise<{ id: string } | null>,
	});
	return { promise, del };
}

describe('deleteSingletonRow', () => {
	it('deletes the existing row', async () => {
		const find = vi.fn().mockResolvedValue({ id: 'row1' });
		const { promise, del } = runDelete({ find });
		await promise;
		expect(del).toHaveBeenCalledWith('row1');
	});

	it('no-ops when there is no row to delete', async () => {
		const find = vi.fn().mockResolvedValue(null);
		const { promise, del } = runDelete({ find });
		await expect(promise).resolves.toBeUndefined();
		expect(del).not.toHaveBeenCalled();
	});

	it('swallows a 404 from a lost delete race once the row is confirmed gone', async () => {
		// find: the row up front, then nothing — the concurrent writer already removed it.
		const find = vi.fn().mockResolvedValueOnce({ id: 'row1' }).mockResolvedValueOnce(null);
		const del = vi.fn().mockRejectedValue(pbError(404, 'Not Found'));
		const { promise } = runDelete({ find, del });
		await expect(promise).resolves.toBeUndefined();
		expect(find).toHaveBeenCalledTimes(2);
	});

	it('rethrows a 404 when the row survived (a rule or hook refused the delete)', async () => {
		const find = vi.fn().mockResolvedValue({ id: 'row1' });
		const del = vi.fn().mockRejectedValue(pbError(404, 'Not Found'));
		const { promise } = runDelete({ find, del });
		await expect(promise).rejects.toThrow('Not Found');
	});

	it('rethrows a non-404 delete error so a real failure stays visible', async () => {
		const find = vi.fn().mockResolvedValue({ id: 'row1' });
		const del = vi.fn().mockRejectedValue(pbError(403, 'Forbidden'));
		const { promise } = runDelete({ find, del });
		await expect(promise).rejects.toThrow('Forbidden');
		expect(find).toHaveBeenCalledTimes(1); // no pointless re-read on a non-race error
	});
});
