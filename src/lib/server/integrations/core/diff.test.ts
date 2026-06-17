import { describe, it, expect } from 'vitest';
import { DESCRIPTION_PREFIX } from '$lib/server/itemArchive';
import { diffItems } from './diff';
import type { ExistingItem, MappedItem } from './types';

const base: MappedItem = {
	externalId: 'rec1',
	name: 'Bohrmaschine',
	description: 'Stark.\n\nInventarnummer: 1',
	status: 'available',
	categories: ['Werkzeug und Garten'],
	externalImgUrl: '',
	externalUrl: '',
	place: 'Lüneburg',
	owner: 'inst1',
	trusteesOnly: false,
};

function existingFrom(item: MappedItem, overrides: Partial<ExistingItem> = {}): ExistingItem {
	return {
		id: 'pbid1',
		externalId: item.externalId,
		name: item.name,
		description: item.description,
		status: item.status,
		categories: item.categories,
		externalImgUrl: item.externalImgUrl,
		externalUrl: item.externalUrl,
		place: item.place,
		...overrides,
	};
}

describe('diffItems', () => {
	it('creates new items with no existing match', () => {
		const result = diffItems([base], []);
		expect(result.toCreate).toEqual([base]);
		expect(result.toUpdate).toHaveLength(0);
		expect(result.toArchive).toHaveLength(0);
		expect(result.skipped).toBe(0);
	});

	it('updates items whose fields changed', () => {
		const existing = existingFrom(base, { name: 'Alter Name' });
		const result = diffItems([base], [existing]);
		expect(result.toCreate).toHaveLength(0);
		expect(result.toUpdate).toEqual([{ id: 'pbid1', data: base }]);
		expect(result.skipped).toBe(0);
	});

	it('skips unchanged items', () => {
		const result = diffItems([base], [existingFrom(base)]);
		expect(result.toCreate).toHaveLength(0);
		expect(result.toUpdate).toHaveLength(0);
		expect(result.skipped).toBe(1);
	});

	it('treats category reordering as unchanged', () => {
		const multi: MappedItem = { ...base, categories: ['Küche', 'Für Kinder'] };
		const existing = existingFrom(multi, { categories: ['Für Kinder', 'Küche'] });
		const result = diffItems([multi], [existing]);
		expect(result.skipped).toBe(1);
		expect(result.toUpdate).toHaveLength(0);
	});

	it('archives items absent from the source', () => {
		const existing = existingFrom(base, { externalId: 'rec-gone' });
		const result = diffItems([], [existing]);
		expect(result.toArchive).toEqual([existing]);
		expect(result.skipped).toBe(0);
	});

	it('skips items already archived (no double-archive)', () => {
		const existing = existingFrom(base, {
			externalId: 'rec-gone',
			status: 'unavailable',
			description: `${DESCRIPTION_PREFIX}Alte Beschreibung`,
		});
		const result = diffItems([], [existing]);
		expect(result.toArchive).toHaveLength(0);
		expect(result.skipped).toBe(1);
	});

	it('un-archives a reappearing item by detecting the change', () => {
		const existing = existingFrom(base, {
			status: 'unavailable',
			description: `${DESCRIPTION_PREFIX}Alte Beschreibung`,
		});
		const result = diffItems([base], [existing]);
		expect(result.toUpdate).toEqual([{ id: 'pbid1', data: base }]);
		expect(result.toArchive).toHaveLength(0);
	});
});
