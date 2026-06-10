import { describe, it, expect } from 'vitest';
import { filterTrustedItems } from './itemFilters';
import type { Item } from '$lib/types/models';

const base: Omit<Item, 'trusteesOnly' | 'expand'> = {
	id: 'item1',
	created: '2025-01-01T00:00:00Z',
	updated: '2025-01-01T00:00:00Z',
	collectionId: 'items',
	name: 'Bohrmaschine',
	description: '',
	image: null,
	place: 'Berlin',
	owner: 'owner1',
	status: 'available'
};

function makeItem(trusteesOnly: boolean, ownerTrusts: string[] | undefined = undefined): Item {
	return {
		...base,
		trusteesOnly,
		expand: ownerTrusts !== undefined ? { owner: { trusts: ownerTrusts } } : undefined
	};
}

describe('filterTrustedItems', () => {
	describe('empty input', () => {
		it('returns empty array when no items are given', () => {
			expect(filterTrustedItems([], 'user1', true)).toEqual([]);
			expect(filterTrustedItems([], null, false)).toEqual([]);
		});
	});

	describe('non-restricted items (trusteesOnly = false)', () => {
		it('includes items when user is logged out', () => {
			const item = makeItem(false);
			expect(filterTrustedItems([item], null, false)).toHaveLength(1);
		});

		it('includes items when user is logged in', () => {
			const item = makeItem(false);
			expect(filterTrustedItems([item], 'user1', true)).toHaveLength(1);
		});
	});

	describe('restricted items (trusteesOnly = true)', () => {
		it('excludes items when user is logged out', () => {
			const item = makeItem(true, ['user1']);
			expect(filterTrustedItems([item], null, false)).toHaveLength(0);
		});

		it('excludes items when loggedIn is false even if userId is provided', () => {
			// Defensive: caller passes loggedIn=false with a userId — should still exclude
			const item = makeItem(true, ['user1']);
			expect(filterTrustedItems([item], 'user1', false)).toHaveLength(0);
		});

		it('includes items when logged-in user is in the owner trusts list', () => {
			const item = makeItem(true, ['user1', 'user2']);
			expect(filterTrustedItems([item], 'user1', true)).toHaveLength(1);
		});

		it('excludes items when logged-in user is not in the owner trusts list', () => {
			const item = makeItem(true, ['user2', 'user3']);
			expect(filterTrustedItems([item], 'user1', true)).toHaveLength(0);
		});

		it('excludes items when owner trusts list is empty', () => {
			const item = makeItem(true, []);
			expect(filterTrustedItems([item], 'user1', true)).toHaveLength(0);
		});

		it('excludes items when expand is missing entirely', () => {
			const item: Item = { ...base, trusteesOnly: true };
			expect(filterTrustedItems([item], 'user1', true)).toHaveLength(0);
		});

		it('excludes items when expand.owner is missing', () => {
			const item: Item = { ...base, trusteesOnly: true, expand: {} };
			expect(filterTrustedItems([item], 'user1', true)).toHaveLength(0);
		});

		it('excludes items when expand.owner.trusts is missing', () => {
			const item: Item = { ...base, trusteesOnly: true, expand: { owner: {} } };
			expect(filterTrustedItems([item], 'user1', true)).toHaveLength(0);
		});

		it('excludes items when userId is null even if loggedIn is true', () => {
			// Defensive: inconsistent caller state — trust the userId check
			const item = makeItem(true, ['user1']);
			expect(filterTrustedItems([item], null, true)).toHaveLength(0);
		});
	});

	describe('mixed item lists', () => {
		it('keeps non-restricted items and trusted-restricted items, drops untrusted-restricted items', () => {
			const publicItem = makeItem(false);
			const trustedItem = makeItem(true, ['user1']);
			const restrictedItem = makeItem(true, ['user2']);
			const noExpandItem: Item = { ...base, id: 'item4', trusteesOnly: true };

			const result = filterTrustedItems(
				[publicItem, trustedItem, restrictedItem, noExpandItem],
				'user1',
				true
			);

			expect(result).toHaveLength(2);
			expect(result).toContain(publicItem);
			expect(result).toContain(trustedItem);
		});

		it('returns only non-restricted items when user is logged out', () => {
			const publicItem = makeItem(false);
			const restrictedItem = makeItem(true, ['user1']);

			const result = filterTrustedItems([publicItem, restrictedItem], null, false);

			expect(result).toHaveLength(1);
			expect(result).toContain(publicItem);
		});
	});
});
