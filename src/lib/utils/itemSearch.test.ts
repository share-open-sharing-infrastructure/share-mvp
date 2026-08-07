import { describe, it, expect } from 'vitest';
import { matchesItemSearch, isAvailable } from './itemSearch';

describe('matchesItemSearch', () => {
	it('matches every item for an empty search', () => {
		expect(matchesItemSearch({ name: 'Bohrer', description: 'x' }, '')).toBe(true);
		expect(matchesItemSearch({}, '')).toBe(true);
	});

	it('matches on the name', () => {
		expect(matchesItemSearch({ name: 'Akku-Bohrmaschine', description: '' }, 'bohr')).toBe(true);
		expect(matchesItemSearch({ name: 'Standmixer', description: '' }, 'bohr')).toBe(false);
	});

	it('matches on the description', () => {
		expect(matchesItemSearch({ name: 'Mixer', description: 'Für Smoothies' }, 'smoothies')).toBe(true);
		expect(matchesItemSearch({ name: 'Mixer', description: 'Für Smoothies' }, 'zelt')).toBe(false);
	});

	it('does not throw on missing name or description', () => {
		expect(matchesItemSearch({ description: 'Zelt' }, 'zelt')).toBe(true);
		expect(matchesItemSearch({ name: 'Zelt' }, 'zelt')).toBe(true);
		expect(matchesItemSearch({}, 'zelt')).toBe(false);
	});
});

describe('isAvailable', () => {
	it('keeps everything except explicitly unavailable items', () => {
		expect(isAvailable({ status: 'available' })).toBe(true);
		expect(isAvailable({ status: 'unknown' })).toBe(true);
		expect(isAvailable({})).toBe(true); // missing status passes (matches /search)
		expect(isAvailable({ status: 'unavailable' })).toBe(false);
	});
});
