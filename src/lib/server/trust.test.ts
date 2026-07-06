import { describe, it, expect, vi } from 'vitest';
import type PocketBase from 'pocketbase';
import { isTrusting, addTrust, removeTrust, getTrustees, getTrusters } from './trust';

function mockFilter(raw: string, params?: Record<string, unknown>): string {
	if (!params) return raw;
	let result = raw;
	for (const [key, value] of Object.entries(params)) {
		const escaped = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : `${value}`;
		result = result.replaceAll(`{:${key}}`, escaped);
	}
	return result;
}

/** Build a pb whose `trusts` collection uses the provided method mocks. */
function makePb(trusts: Record<string, ReturnType<typeof vi.fn>>): PocketBase {
	return {
		collection: vi.fn((name: string) => (name === 'trusts' ? trusts : {})),
		filter: vi.fn(mockFilter),
	} as unknown as PocketBase;
}

describe('isTrusting', () => {
	it('is true when a matching edge exists', async () => {
		const getFirstListItem = vi.fn().mockResolvedValue({ id: 't1' });
		const pb = makePb({ getFirstListItem });
		expect(await isTrusting(pb, 'a', 'b')).toBe(true);
		expect(getFirstListItem).toHaveBeenCalledWith("truster = 'a' && trustee = 'b'", { fields: 'id' });
	});

	it('is false when no edge exists', async () => {
		const pb = makePb({ getFirstListItem: vi.fn().mockRejectedValue(new Error('none')) });
		expect(await isTrusting(pb, 'a', 'b')).toBe(false);
	});
});

describe('addTrust', () => {
	it('creates an edge when none exists', async () => {
		const create = vi.fn().mockResolvedValue({ id: 't1' });
		const pb = makePb({ getFirstListItem: vi.fn().mockRejectedValue(new Error('none')), create });
		await addTrust(pb, 'a', 'b');
		expect(create).toHaveBeenCalledWith({ truster: 'a', trustee: 'b' });
	});

	it('is a no-op when the edge already exists (idempotent)', async () => {
		const create = vi.fn();
		const pb = makePb({ getFirstListItem: vi.fn().mockResolvedValue({ id: 't1' }), create });
		await addTrust(pb, 'a', 'b');
		expect(create).not.toHaveBeenCalled();
	});

	it('never creates a self-trust edge', async () => {
		const create = vi.fn();
		const getFirstListItem = vi.fn();
		const pb = makePb({ getFirstListItem, create });
		await addTrust(pb, 'a', 'a');
		expect(create).not.toHaveBeenCalled();
		expect(getFirstListItem).not.toHaveBeenCalled();
	});
});

describe('removeTrust', () => {
	it('deletes the matching edge', async () => {
		const del = vi.fn().mockResolvedValue(true);
		const pb = makePb({ getFirstListItem: vi.fn().mockResolvedValue({ id: 't1' }), delete: del });
		await removeTrust(pb, 'a', 'b');
		expect(del).toHaveBeenCalledWith('t1');
	});

	it('is a no-op when there is no edge', async () => {
		const del = vi.fn();
		const pb = makePb({ getFirstListItem: vi.fn().mockRejectedValue(new Error('none')), delete: del });
		await removeTrust(pb, 'a', 'b');
		expect(del).not.toHaveBeenCalled();
	});
});

describe('getTrustees / getTrusters', () => {
	it('getTrustees filters by truster and expands the trustee', async () => {
		const getFullList = vi.fn().mockResolvedValue([{ id: 't1', truster: 'a', trustee: 'b' }]);
		const pb = makePb({ getFullList });
		await getTrustees(pb, 'a');
		expect(getFullList).toHaveBeenCalledWith({ filter: "truster = 'a'", expand: 'trustee' });
	});

	it('getTrusters filters by trustee and expands the truster', async () => {
		const getFullList = vi.fn().mockResolvedValue([{ id: 't2', truster: 'c', trustee: 'a' }]);
		const pb = makePb({ getFullList });
		await getTrusters(pb, 'a');
		expect(getFullList).toHaveBeenCalledWith({ filter: "trustee = 'a'", expand: 'truster' });
	});
});
