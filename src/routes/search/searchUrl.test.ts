import { describe, it, expect, vi } from 'vitest';
import { buildSearchUrl } from './searchUrl';
import { parseSearchParameters } from './searchFilter';

vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));

describe('buildSearchUrl', () => {
	it('encodes onlyAvailable=true when the override is active', () => {
		const url = buildSearchUrl({ onlyAvailable: true });
		expect(url).toContain('onlyAvailable=true');
	});

	it('omits the onlyAvailable param entirely when false (the default)', () => {
		const url = buildSearchUrl({ onlyAvailable: false });
		expect(url).not.toContain('onlyAvailable');
	});

	it('omits the onlyAvailable param entirely when undefined', () => {
		const url = buildSearchUrl({ onlyAvailable: undefined });
		expect(url).not.toContain('onlyAvailable');
	});

	it('combines q and onlyAvailable with an "&"', () => {
		const url = buildSearchUrl({ q: 'bohrer', onlyAvailable: true });
		expect(url).toBe('/search?q=bohrer&onlyAvailable=true');
	});

	it('encodes cats and page alongside each other', () => {
		const url = buildSearchUrl({
			cats: ['Werkzeug', 'Garten'],
			page: 3,
		});
		expect(url).toBe('/search?page=3&cats=Werkzeug%2CGarten');
	});

	it('returns the bare search path when no params are set', () => {
		expect(buildSearchUrl({})).toBe('/search');
	});

	it('includes sort when non-default', () => {
		const url = buildSearchUrl({ sort: 'name_asc' });
		expect(url).toBe('/search?sort=name_asc');
	});

	it('omits sort entirely when "newest" (the default)', () => {
		expect(buildSearchUrl({ sort: 'newest' })).toBe('/search');
	});

	it('omits sort entirely when undefined', () => {
		expect(buildSearchUrl({ sort: undefined })).toBe('/search');
	});
});

// Roundtrip invariant: buildSearchUrl and parseSearchParameters MUST agree on every default.
// This is the guard that #556 was missing — a future default flip on only one side (as PR #536
// did) breaks one of these cases immediately instead of silently.
describe('buildSearchUrl ↔ parseSearchParameters roundtrip', () => {
	const roundtrip = (params: Parameters<typeof buildSearchUrl>[0]) =>
		parseSearchParameters(new URL(buildSearchUrl(params), 'https://x.test'));

	it('preserves onlyAvailable for both true and false', () => {
		expect(roundtrip({ onlyAvailable: true }).onlyAvailable).toBe(true);
		expect(roundtrip({ onlyAvailable: false }).onlyAvailable).toBe(false);
	});

	it('preserves the rest of the param family', () => {
		const parsed = roundtrip({
			q: 'bohrer',
			cats: ['Werkzeug und Garten', 'Elektronik'],
			ownerType: 'institution',
			page: 3,
			perPage: 50,
		});
		expect(parsed.query).toBe('bohrer');
		expect(parsed.selectedCategories).toEqual([
			'Werkzeug und Garten',
			'Elektronik',
		]);
		expect(parsed.ownerType).toBe('institution');
		expect(parsed.page).toBe(3);
		expect(parsed.perPage).toBe(50);
	});

	it('preserves sort for every option, including the default', () => {
		expect(roundtrip({ sort: 'newest' }).sort).toBe('newest');
		expect(roundtrip({ sort: 'name_asc' }).sort).toBe('name_asc');
		expect(roundtrip({ sort: 'name_desc' }).sort).toBe('name_desc');
	});
});
