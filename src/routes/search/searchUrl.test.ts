import { describe, it, expect, vi } from 'vitest';
import { buildSearchUrl } from './searchUrl';

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

	it('encodes cats, op and page alongside each other', () => {
		const url = buildSearchUrl({ cats: ['Werkzeug', 'Garten'], op: 'and', page: 3 });
		expect(url).toBe('/search?page=3&cats=Werkzeug%2CGarten&op=and');
	});

	it('returns the bare search path when no params are set', () => {
		expect(buildSearchUrl({})).toBe('/search');
	});
});
