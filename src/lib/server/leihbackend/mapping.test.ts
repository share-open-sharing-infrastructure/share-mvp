import { describe, it, expect } from 'vitest';
import { stripHtml, mapCategory, mapItem, type LeihbackendItem } from './mapping';

function makeItem(overrides: Partial<LeihbackendItem> = {}): LeihbackendItem {
	return {
		id: 'rec123',
		iid: 48,
		name: 'Bohrmaschine',
		description: '<p>Eine <strong>kraftvolle</strong> Bohrmaschine.</p>',
		status: 'instock',
		deposit: 0,
		images: [],
		synonyms: '',
		category: ['Werkzeug'],
		brand: '',
		model: '',
		packaging: '',
		manual: '',
		parts: 1,
		copies: 1,
		added_on: '2026-01-01 00:00:00.000Z',
		is_protected: false,
		...overrides,
	};
}

describe('stripHtml', () => {
	it('returns empty string for empty input', () => {
		expect(stripHtml('')).toBe('');
	});

	it('strips nested tags', () => {
		expect(stripHtml('<p>Eine <strong>kraftvolle</strong> Bohrmaschine.</p>')).toBe(
			'Eine kraftvolle Bohrmaschine.'
		);
	});

	it('decodes named entities', () => {
		expect(stripHtml('Tom &amp; Jerry &quot;Show&quot; &lt;3 &nbsp;&amp;&gt;')).toBe(
			'Tom & Jerry "Show" <3 &>'
		);
	});

	it('decodes numeric entities', () => {
		expect(stripHtml('Caf&#233;')).toBe('Café');
	});

	it('converts <br> and </p> to line breaks, preserving paragraphs', () => {
		expect(stripHtml('<p>Zeile 1<br>Zeile 2</p><p>Zweiter Absatz</p>')).toBe(
			'Zeile 1\nZeile 2\n\nZweiter Absatz'
		);
	});

	it('does not treat decoded angle brackets as tags', () => {
		expect(stripHtml('Maße: &lt;b&gt;nicht fett&lt;/b&gt;')).toBe('Maße: <b>nicht fett</b>');
	});

	it('collapses repeated whitespace', () => {
		expect(stripHtml('Viel    Platz\t\there')).toBe('Viel Platz here');
	});
});

describe('mapCategory', () => {
	it('maps werkzeug/garten/bohr keywords', () => {
		expect(mapCategory(['Werkzeug'])).toEqual(['Werkzeug und Garten']);
		expect(mapCategory(['Gartenbedarf'])).toEqual(['Werkzeug und Garten']);
		expect(mapCategory(['Bohrmaschinen'])).toEqual(['Werkzeug und Garten']);
	});

	it('maps küche/koch keywords', () => {
		expect(mapCategory(['Küche'])).toEqual(['Küche']);
		expect(mapCategory(['Kochen'])).toEqual(['Küche']);
	});

	it('maps spielzeug für kinder to Für Kinder, not Spiele', () => {
		expect(mapCategory(['Spielzeug für Kinder'])).toEqual(['Für Kinder']);
	});

	it('maps generic spiel to Spiele', () => {
		expect(mapCategory(['Gesellschaftsspiele'])).toEqual(['Spiele']);
	});

	it('maps kind/baby keywords to Für Kinder', () => {
		expect(mapCategory(['Kinderwagen'])).toEqual(['Für Kinder']);
		expect(mapCategory(['Babyausstattung'])).toEqual(['Für Kinder']);
	});

	it('maps sport/freizeit/fitness keywords', () => {
		expect(mapCategory(['Sportgeräte'])).toEqual(['Freizeit und Sport']);
		expect(mapCategory(['Freizeit'])).toEqual(['Freizeit und Sport']);
		expect(mapCategory(['Fitnessgeräte'])).toEqual(['Freizeit und Sport']);
	});

	it('maps camping/outdoor/reise/zelt keywords', () => {
		expect(mapCategory(['Camping'])).toEqual(['Reisen und Outdoor']);
		expect(mapCategory(['Outdoor-Ausrüstung'])).toEqual(['Reisen und Outdoor']);
		expect(mapCategory(['Reisegepäck'])).toEqual(['Reisen und Outdoor']);
		expect(mapCategory(['Zelte'])).toEqual(['Reisen und Outdoor']);
	});

	it('maps elektro/computer keywords', () => {
		expect(mapCategory(['Elektrogeräte'])).toEqual(['Elektronik']);
		expect(mapCategory(['Computer & Zubehör'])).toEqual(['Elektronik']);
	});

	it('maps musik/licht/ton/audio/beamer keywords', () => {
		expect(mapCategory(['Musikinstrumente'])).toEqual(['Ton und Licht']);
		expect(mapCategory(['Lichttechnik'])).toEqual(['Ton und Licht']);
		expect(mapCategory(['Tontechnik'])).toEqual(['Ton und Licht']);
		expect(mapCategory(['Audiogeräte'])).toEqual(['Ton und Licht']);
		expect(mapCategory(['Beamer'])).toEqual(['Ton und Licht']);
	});

	it('maps buch keyword', () => {
		expect(mapCategory(['Bücher & Hörbücher'])).toEqual(['Bücher']);
	});

	it('falls back to Sonstiges for unknown, empty, or missing categories', () => {
		expect(mapCategory(['Diverses'])).toEqual(['Sonstiges']);
		expect(mapCategory([''])).toEqual(['Sonstiges']);
		expect(mapCategory([])).toEqual(['Sonstiges']);
		expect(mapCategory(undefined)).toEqual(['Sonstiges']);
		expect(mapCategory(null)).toEqual(['Sonstiges']);
	});

	it('is case-insensitive', () => {
		expect(mapCategory(['WERKZEUG'])).toEqual(['Werkzeug und Garten']);
	});

	it('maps multiple tags to deduplicated categories, capped at 3', () => {
		expect(mapCategory(['Haushalt', 'Garten'])).toEqual(['Werkzeug und Garten']);
		expect(mapCategory(['Werkzeug', 'Bohrmaschinen', 'Gartenbedarf'])).toEqual(['Werkzeug und Garten']);
		expect(mapCategory(['Werkzeug', 'Küche', 'Musik', 'Camping'])).toEqual([
			'Werkzeug und Garten',
			'Küche',
			'Ton und Licht',
		]);
	});
});

describe('mapItem', () => {
	const ctx = { baseUrl: 'https://allerlei.uber.space', ownerId: 'owner123', city: 'Lüneburg' };

	it.each([
		['instock', 'available'],
		['outofstock', 'unavailable'],
		['onbackorder', 'unavailable'],
		['reserved', 'unavailable'],
		['lost', 'unavailable'],
		['repairing', 'unavailable'],
		['forsale', 'unavailable'],
	] as const)('maps status %s to %s', (status, expected) => {
		const mapped = mapItem(makeItem({ status }), ctx);
		expect(mapped.status).toBe(expected);
	});

	it('maps basic fields', () => {
		const mapped = mapItem(makeItem(), ctx);
		expect(mapped.externalId).toBe('rec123');
		expect(mapped.name).toBe('Bohrmaschine');
		expect(mapped.owner).toBe('owner123');
		expect(mapped.place).toBe('Lüneburg');
		expect(mapped.trusteesOnly).toBe(false);
	});

	it('falls back to empty place when no city is configured', () => {
		const mapped = mapItem(makeItem(), { baseUrl: ctx.baseUrl, ownerId: ctx.ownerId });
		expect(mapped.place).toBe('');
	});

	it('truncates the name to 200 chars', () => {
		const longName = 'A'.repeat(250);
		const mapped = mapItem(makeItem({ name: longName }), ctx);
		expect(mapped.name).toHaveLength(200);
	});

	it('always includes Inventarnummer in the description block', () => {
		const mapped = mapItem(makeItem({ description: '', iid: 99 }), ctx);
		expect(mapped.description).toBe('Inventarnummer: 99');
	});

	it('omits Teile when parts is 1, includes it when > 1', () => {
		const single = mapItem(makeItem({ description: '', parts: 1 }), ctx);
		expect(single.description).not.toContain('Teile:');

		const multi = mapItem(makeItem({ description: '', parts: 3 }), ctx);
		expect(multi.description).toContain('Teile: 3');
	});

	it('omits Kaution when deposit is 0, includes it when > 0', () => {
		const free = mapItem(makeItem({ description: '', deposit: 0 }), ctx);
		expect(free.description).not.toContain('Kaution:');

		const deposit = mapItem(makeItem({ description: '', deposit: 25 }), ctx);
		expect(deposit.description).toContain('Kaution: 25 €');
	});

	it('includes Marke and Modell only when set', () => {
		const withoutBrand = mapItem(makeItem({ description: '', brand: '', model: '' }), ctx);
		expect(withoutBrand.description).not.toContain('Marke:');
		expect(withoutBrand.description).not.toContain('Modell:');

		const withBrand = mapItem(makeItem({ description: '', brand: 'Bosch', model: 'PSB 1800' }), ctx);
		expect(withBrand.description).toContain('Marke: Bosch');
		expect(withBrand.description).toContain('Modell: PSB 1800');
	});

	it('appends the structured block after the stripped description, separated by a blank line', () => {
		const mapped = mapItem(
			makeItem({ description: '<p>Stark und zuverlässig.</p>', iid: 7, brand: 'Bosch' }),
			ctx
		);
		expect(mapped.description).toBe('Stark und zuverlässig.\n\nInventarnummer: 7\nMarke: Bosch');
	});

	it('truncates the combined description to 4000 chars', () => {
		const longDescription = `<p>${'X'.repeat(5000)}</p>`;
		const mapped = mapItem(makeItem({ description: longDescription }), ctx);
		expect(mapped.description).toHaveLength(4000);
	});

	it('builds externalImgUrl from the first image, empty string if none', () => {
		const withImage = mapItem(makeItem({ images: ['foto1.jpg', 'foto2.jpg'] }), ctx);
		expect(withImage.externalImgUrl).toBe('https://allerlei.uber.space/api/files/item/rec123/foto1.jpg');

		const withoutImage = mapItem(makeItem({ images: [] }), ctx);
		expect(withoutImage.externalImgUrl).toBe('');
	});

	it('substitutes {id} and {iid} in the url template', () => {
		const mapped = mapItem(makeItem({ id: 'rec123', iid: 48 }), {
			...ctx,
			urlTemplate: 'https://allerlei.uber.space/reservierung/{iid}',
		});
		expect(mapped.externalUrl).toBe('https://allerlei.uber.space/reservierung/48');

		const mapped2 = mapItem(makeItem({ id: 'rec123', iid: 48 }), {
			...ctx,
			urlTemplate: 'https://allerlei.uber.space/items/{id}/{iid}',
		});
		expect(mapped2.externalUrl).toBe('https://allerlei.uber.space/items/rec123/48');
	});

	it('returns empty externalUrl when no template is configured', () => {
		const mapped = mapItem(makeItem(), ctx);
		expect(mapped.externalUrl).toBe('');
	});

	it('maps category via mapCategory', () => {
		const mapped = mapItem(makeItem({ category: ['Werkzeug'] }), ctx);
		expect(mapped.categories).toEqual(['Werkzeug und Garten']);
	});
});
