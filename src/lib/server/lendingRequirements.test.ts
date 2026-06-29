import { describe, it, expect, vi, beforeEach } from 'vitest';
import type PocketBase from 'pocketbase';
import {
	getOwnerRequirements,
	evaluateUnmetRequirements,
	upsertOwnerRequirements,
	getRequirementSettings,
	requirementFields
} from './lendingRequirements';
import type { LendingRequirements } from '$lib/types/models';

function mockFilter(raw: string, params?: Record<string, unknown>): string {
	if (!params) return raw;
	let result = raw;
	for (const [key, value] of Object.entries(params)) {
		const escaped = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : `${value}`;
		result = result.replaceAll(`{:${key}}`, escaped);
	}
	return result;
}

function makeMockPb(collectionImpl: (name: string) => object): PocketBase {
	return {
		collection: vi.fn((name: string) => collectionImpl(name)),
		filter: vi.fn(mockFilter)
	} as unknown as PocketBase;
}

const stubRequirements: LendingRequirements = {
	id: 'lr1',
	created: '2025-01-01T00:00:00Z',
	updated: '2025-01-01T00:00:00Z',
	owner: 'owner1',
	requireVerifiedEmail: true,
	requireAddress: false
};

// ---------------------------------------------------------------------------
// getOwnerRequirements
// ---------------------------------------------------------------------------

describe('getOwnerRequirements', () => {
	let mockGetFirstListItem: ReturnType<typeof vi.fn>;
	let pb: PocketBase;

	beforeEach(() => {
		mockGetFirstListItem = vi.fn();
		pb = makeMockPb(() => ({ getFirstListItem: mockGetFirstListItem }));
	});

	it('returns the record when PocketBase resolves', async () => {
		mockGetFirstListItem.mockResolvedValue(stubRequirements);
		expect(await getOwnerRequirements(pb, 'owner1')).toEqual(stubRequirements);
	});

	it('returns null when PocketBase throws (no row)', async () => {
		mockGetFirstListItem.mockRejectedValue(new Error('404'));
		expect(await getOwnerRequirements(pb, 'owner1')).toBeNull();
	});

	it('queries the lending_requirements collection by owner', async () => {
		mockGetFirstListItem.mockResolvedValue(stubRequirements);
		await getOwnerRequirements(pb, 'owner1');
		expect((pb.collection as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('lending_requirements');
		const [filter] = mockGetFirstListItem.mock.calls[0];
		expect(filter).toContain("owner = 'owner1'");
	});
});

// ---------------------------------------------------------------------------
// evaluateUnmetRequirements
// ---------------------------------------------------------------------------

describe('evaluateUnmetRequirements', () => {
	function pbWith(requirements: LendingRequirements | Error): PocketBase {
		const get = vi.fn().mockImplementation(() =>
			requirements instanceof Error
				? Promise.reject(requirements)
				: Promise.resolve(requirements)
		);
		return makeMockPb(() => ({ getFirstListItem: get }));
	}

	it('returns empty when the owner has no requirements row', async () => {
		const pb = pbWith(new Error('404'));
		expect(await evaluateUnmetRequirements(pb, 'owner1', { verified: false })).toEqual([]);
	});

	it('returns empty when the enabled requirement is met (verified email)', async () => {
		const pb = pbWith(stubRequirements);
		expect(await evaluateUnmetRequirements(pb, 'owner1', { verified: true })).toEqual([]);
	});

	it('reports verifiedEmail as unmet when borrower is unverified', async () => {
		const pb = pbWith(stubRequirements);
		const unmet = await evaluateUnmetRequirements(pb, 'owner1', { verified: false });
		expect(unmet).toHaveLength(1);
		expect(unmet[0].key).toBe('verifiedEmail');
		expect(unmet[0].actionHref).toBe('/user/profile#email');
	});

	it('ignores a disabled requirement even if unsatisfied', async () => {
		const pb = pbWith({ ...stubRequirements, requireVerifiedEmail: false });
		expect(await evaluateUnmetRequirements(pb, 'owner1', { verified: false })).toEqual([]);
	});

	it('reports address as unmet when borrower has no city', async () => {
		const pb = pbWith({ ...stubRequirements, requireVerifiedEmail: false, requireAddress: true });
		const unmet = await evaluateUnmetRequirements(pb, 'owner1', { verified: true, city: '' });
		expect(unmet).toHaveLength(1);
		expect(unmet[0].key).toBe('address');
	});

	it('treats whitespace-only city as no address', async () => {
		const pb = pbWith({ ...stubRequirements, requireVerifiedEmail: false, requireAddress: true });
		const unmet = await evaluateUnmetRequirements(pb, 'owner1', { verified: true, city: '   ' });
		expect(unmet.map((u) => u.key)).toEqual(['address']);
	});

	it('accepts a borrower with a city when address is required', async () => {
		const pb = pbWith({ ...stubRequirements, requireVerifiedEmail: false, requireAddress: true });
		expect(await evaluateUnmetRequirements(pb, 'owner1', { verified: true, city: 'Kassel' })).toEqual([]);
	});

	it('reports both requirements when both enabled and unmet', async () => {
		const pb = pbWith({ ...stubRequirements, requireVerifiedEmail: true, requireAddress: true });
		const keys = (await evaluateUnmetRequirements(pb, 'owner1', { verified: false, city: '' })).map((u) => u.key);
		expect(keys).toEqual(['verifiedEmail', 'address']);
	});

	it('returns only the unmet one when both enabled but email is satisfied', async () => {
		const pb = pbWith({ ...stubRequirements, requireVerifiedEmail: true, requireAddress: true });
		const unmet = await evaluateUnmetRequirements(pb, 'owner1', { verified: true, city: '' });
		expect(unmet).toHaveLength(1);
		expect(unmet[0].key).toBe('address');
		// carries address-specific copy, not the email one
		expect(unmet[0].actionLabel).not.toBe('');
		expect(unmet[0].actionHref).toBe('/user/profile#address');
	});
});

// ---------------------------------------------------------------------------
// getRequirementSettings
// ---------------------------------------------------------------------------

describe('getRequirementSettings', () => {
	it('returns one setting per requirement, all disabled when no row', () => {
		const settings = getRequirementSettings(null);
		expect(settings.map((s) => s.key)).toEqual(['verifiedEmail', 'address']);
		expect(settings.every((s) => s.enabled === false)).toBe(true);
		expect(settings.map((s) => s.field)).toEqual(requirementFields);
	});

	it('reflects the enabled flags from the row', () => {
		const settings = getRequirementSettings({ ...stubRequirements, requireVerifiedEmail: true, requireAddress: false });
		const byKey = Object.fromEntries(settings.map((s) => [s.key, s.enabled]));
		expect(byKey.verifiedEmail).toBe(true);
		expect(byKey.address).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// upsertOwnerRequirements
// ---------------------------------------------------------------------------

describe('upsertOwnerRequirements', () => {
	function makePb(opts: {
		existing?: LendingRequirements | null;
		existingAfterRace?: LendingRequirements | null;
		createRejects?: boolean;
	}) {
		const getFirstListItem = vi
			.fn()
			.mockImplementationOnce(() =>
				opts.existing ? Promise.resolve(opts.existing) : Promise.reject(new Error('404'))
			)
			.mockImplementation(() =>
				opts.existingAfterRace
					? Promise.resolve(opts.existingAfterRace)
					: Promise.reject(new Error('404'))
			);
		const create = vi
			.fn()
			.mockImplementation(() =>
				opts.createRejects ? Promise.reject(new Error('unique constraint')) : Promise.resolve({ id: 'new' })
			);
		const update = vi.fn().mockResolvedValue({});
		const pb = makeMockPb(() => ({ getFirstListItem, create, update }));
		return { pb, getFirstListItem, create, update };
	}

	it('creates a new row when none exists', async () => {
		const { pb, create, update } = makePb({ existing: null });
		await upsertOwnerRequirements(pb, 'owner1', { requireVerifiedEmail: true });
		expect(create).toHaveBeenCalledWith({ owner: 'owner1', requireVerifiedEmail: true });
		expect(update).not.toHaveBeenCalled();
	});

	it('updates the existing row when one exists', async () => {
		const { pb, create, update } = makePb({ existing: stubRequirements });
		await upsertOwnerRequirements(pb, 'owner1', { requireAddress: true });
		expect(update).toHaveBeenCalledWith('lr1', { requireAddress: true });
		expect(create).not.toHaveBeenCalled();
	});

	it('falls back to update when a create race hits the unique index', async () => {
		const raced = { ...stubRequirements, id: 'lr-raced' };
		const { pb, create, update } = makePb({ existing: null, createRejects: true, existingAfterRace: raced });
		await upsertOwnerRequirements(pb, 'owner1', { requireVerifiedEmail: true });
		expect(create).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledWith('lr-raced', { requireVerifiedEmail: true });
	});
});
