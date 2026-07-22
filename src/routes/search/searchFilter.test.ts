import { describe, it, expect } from 'vitest';
import {
	buildSearchFilter,
	buildItemFilter,
	parseSearchParameters,
	sortToPbSort,
	type SearchParameters,
} from './searchFilter';

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
		selectedGroup: null,
		sort: 'newest',
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

	it('adds no group clause when no group is selected', () => {
		expect(buildItemFilter({ ...base, query: 'x' })).not.toContain('groups');
	});

	it('adds exactly one group clause with the "~" operator when a group is selected', () => {
		const filter = buildItemFilter({ ...base, selectedGroup: 'abcdefghij01234' });
		expect(filter).toContain('groups ~ "abcdefghij01234"');
		// Only a single group clause is ever emitted (single-select).
		expect(filter?.match(/groups ~ /g)).toHaveLength(1);
	});

	it('combines the group clause with query, categories, availability and ownerType', () => {
		const filter = buildItemFilter(
			{
				...base,
				query: 'zelt',
				selectedCategories: ['Reisen und Outdoor'],
				onlyAvailable: true,
				ownerType: 'private',
				selectedGroup: 'abcdefghij01234',
			},
			'user123'
		);
		expect(filter).toContain('name ~ "zelt"');
		expect(filter).toContain('categories ~ ');
		expect(filter).toContain("status != 'unavailable'");
		expect(filter).toContain('isInstitution != true');
		expect(filter).toContain('userId != "user123"');
		expect(filter).toContain('groups ~ "abcdefghij01234"');
		// All clauses are AND-combined.
		expect(filter).toContain(' && ');
	});

	it('escapes double quotes in the group id (defense-in-depth)', () => {
		// The parser already restricts the value to a 15-char id; the builder still escapes.
		const filter = buildItemFilter({ ...base, selectedGroup: 'ab"cd' });
		expect(filter).toContain('groups ~ "ab\\"cd"');
	});
});

describe('parseSearchParameters', () => {
	it('parses the query from the q parameter', () => {
		const params = parseSearchParameters(new URL('https://x.test/search?q=hammer'));
		expect(params.query).toBe('hammer');
	});

	it('accepts a well-formed 15-char group id', () => {
		const params = parseSearchParameters(new URL('https://x.test/search?group=abcdefghij01234'));
		expect(params.selectedGroup).toBe('abcdefghij01234');
	});

	it('defaults selectedGroup to null when the param is missing or empty', () => {
		expect(parseSearchParameters(new URL('https://x.test/search')).selectedGroup).toBeNull();
		expect(parseSearchParameters(new URL('https://x.test/search?group=')).selectedGroup).toBeNull();
	});

	it('drops malformed group ids to null (injection, wrong length, quotes, whitespace)', () => {
		const cases = ['<script>', 'abcdefghij0123456789012345', 'ab"cdefghij0123', '   ', 'short'];
		for (const bad of cases) {
			const url = new URL('https://x.test/search');
			url.searchParams.set('group', bad);
			expect(parseSearchParameters(url).selectedGroup).toBeNull();
		}
	});

	it('defaults sort to "newest" when the param is missing', () => {
		expect(parseSearchParameters(new URL('https://x.test/search')).sort).toBe('newest');
	});

	it('parses each valid sort value', () => {
		for (const sort of ['newest', 'name_asc', 'name_desc']) {
			const url = new URL('https://x.test/search');
			url.searchParams.set('sort', sort);
			expect(parseSearchParameters(url).sort).toBe(sort);
		}
	});

	it('falls back to "newest" for an unknown sort value', () => {
		const url = new URL('https://x.test/search');
		url.searchParams.set('sort', 'bogus');
		expect(parseSearchParameters(url).sort).toBe('newest');
	});
});

describe('sortToPbSort', () => {
	it('maps newest to -created', () => {
		expect(sortToPbSort('newest')).toBe('-created');
	});

	it('maps name_asc to name', () => {
		expect(sortToPbSort('name_asc')).toBe('name');
	});

	it('maps name_desc to -name', () => {
		expect(sortToPbSort('name_desc')).toBe('-name');
	});
});
