import { describe, it, expect } from 'vitest';
import { buildSearchFilter, buildItemFilter, parseSearchParameters, type SearchParameters } from './searchFilter';

describe('buildSearchFilter', () => {
	it('returns null for blank input or the wildcard', () => {
		expect(buildSearchFilter('')).toBeNull();
		expect(buildSearchFilter('   ')).toBeNull();
		expect(buildSearchFilter('*')).toBeNull();
	});

	it('matches a single token against name, description and username', () => {
		expect(buildSearchFilter('bohrer')).toBe(
			'(name ~ "bohrer" || description ~ "bohrer" || username ~ "bohrer")'
		);
	});

	it('combines multiple tokens with AND, each searched across all fields', () => {
		expect(buildSearchFilter('testuser2 zelt')).toBe(
			'(name ~ "testuser2" || description ~ "testuser2" || username ~ "testuser2") && ' +
				'(name ~ "zelt" || description ~ "zelt" || username ~ "zelt")'
		);
	});

	it('escapes double quotes in tokens to prevent filter injection', () => {
		const filter = buildSearchFilter('he"llo');
		expect(filter).toContain('name ~ "he\\"llo"');
		expect(filter).toContain('username ~ "he\\"llo"');
	});
});

describe('buildItemFilter', () => {
	const base: SearchParameters = {
		query: '',
		page: 1,
		perPage: 20,
		selectedCategories: [],
		op: 'or',
		onlyAvailable: true,
		ownerType: 'all',
	};

	it('includes the username clause when a query is present', () => {
		const filter = buildItemFilter({ ...base, query: 'maxmuster' });
		expect(filter).toContain('username ~ "maxmuster"');
	});

	it('returns undefined when no constraints are active (no query, anon user, availability off)', () => {
		expect(buildItemFilter({ ...base, onlyAvailable: false })).toBeUndefined();
	});

	it('excludes the current user’s own items when logged in', () => {
		const filter = buildItemFilter({ ...base, query: 'x' }, 'user123');
		expect(filter).toContain('userId != "user123"');
	});
});

describe('parseSearchParameters', () => {
	it('parses the query from the q parameter', () => {
		const params = parseSearchParameters(new URL('https://x.test/search?q=hammer'));
		expect(params.query).toBe('hammer');
	});
});
