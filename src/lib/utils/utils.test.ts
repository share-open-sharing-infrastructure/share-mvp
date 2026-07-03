import { describe, it, expect } from 'vitest';
import { itemImageUrl, buildMailtoHref, buildItemRedirectHref } from './utils';
import { texts } from '$lib/texts';

const PB_URL = 'https://pb.example.com/';

describe('itemImageUrl', () => {
	it('serves an uploaded file via the items_searchable view, not the record collectionId', () => {
		const url = itemImageUrl(PB_URL, { id: 'item123', image: 'photo_abc.jpg' });
		expect(url).toBe('https://pb.example.com/api/files/items_searchable/item123/photo_abc.jpg');
	});

	it('ignores collectionId entirely (so items_public ids cannot produce 404 URLs)', () => {
		const url = itemImageUrl(PB_URL, {
			id: 'item123',
			image: 'photo_abc.jpg',
			// a collectionId on the record must not leak into the URL
			...({ collectionId: 'pbc_items_public' } as Record<string, unknown>),
		});
		expect(url).not.toContain('pbc_items_public');
		expect(url).toContain('/items_searchable/');
	});

	it('falls back to externalImgUrl when no file is uploaded', () => {
		const url = itemImageUrl(PB_URL, {
			id: 'item123',
			image: null,
			externalImgUrl: 'https://catalogue.example/cover.jpg',
		});
		expect(url).toBe('https://catalogue.example/cover.jpg');
	});

	it('prefers the uploaded file over externalImgUrl', () => {
		const url = itemImageUrl(PB_URL, {
			id: 'item123',
			image: 'photo_abc.jpg',
			externalImgUrl: 'https://catalogue.example/cover.jpg',
		});
		expect(url).toBe('https://pb.example.com/api/files/items_searchable/item123/photo_abc.jpg');
	});

	it('returns null when there is neither a file nor an external image', () => {
		expect(itemImageUrl(PB_URL, { id: 'item123', image: null })).toBeNull();
		expect(itemImageUrl(PB_URL, { id: 'item123', image: '', externalImgUrl: '' })).toBeNull();
	});
});

describe('buildMailtoHref (#438)', () => {
	it('builds a mailto: with encoded subject and body', () => {
		const href = buildMailtoHref('verleih@asta.de', 'Anfrage zu „Bohrer"', 'Hallo,\nDanke');
		expect(href).toBe(
			'mailto:verleih@asta.de?subject=Anfrage%20zu%20%E2%80%9EBohrer%22&body=Hallo%2C%0ADanke'
		);
	});

	it('encodes URL-significant characters in the address so they cannot inject mailto params', () => {
		const href = buildMailtoHref('a&b?c@x.de', 'Sub', 'Body');
		// The local part is percent-encoded; the single @ separator is preserved.
		expect(href.startsWith('mailto:a%26b%3Fc@x.de?')).toBe(true);
		expect(href).not.toContain('&b?c@'); // raw special chars must not survive
	});

	it('returns an empty string for an empty address', () => {
		expect(buildMailtoHref('', 'Sub', 'Body')).toBe('');
	});

	it('wires the German item-detail subject/body builders into a well-formed mailto:', () => {
		// Mirrors how ItemCta.svelte composes the href (#438) — guards the text builders too.
		const href = buildMailtoHref(
			'o@x.test',
			texts.pages.itemDetail.mailtoSubject('Bohrer'),
			texts.pages.itemDetail.mailtoBody('Bohrer')
		);
		expect(href.startsWith('mailto:o@x.test?subject=')).toBe(true);
		expect(href).toContain('Bohrer');
		expect(href).toContain('&body=');
		// The masked-item fallback (item.name ?? unknownItem) must also be encodable.
		expect(buildMailtoHref('o@x.test', texts.pages.itemDetail.mailtoSubject(texts.pages.itemDetail.unknownItem), '')).toContain('subject=');
	});
});

describe('buildItemRedirectHref (#438 link CTA / external items)', () => {
	it('routes the destination through /api/redirect with the item-detail source', () => {
		const href = buildItemRedirectHref('https://verleih.example/form', 'itm123');
		expect(href).toBe(
			'/api/redirect?to=https%3A%2F%2Fverleih.example%2Fform&source=item-detail&item=itm123'
		);
	});

	it('encodes the destination so query-significant characters cannot break out of the `to` param', () => {
		const href = buildItemRedirectHref('https://x.test/a?b=1&c=2#frag', 'i1');
		// The whole URL (incl. ? & #) must be percent-encoded inside `to`, not appended raw.
		expect(href.startsWith('/api/redirect?to=https%3A%2F%2Fx.test%2Fa%3Fb%3D1%26c%3D2%23frag')).toBe(true);
		expect(href.endsWith('&source=item-detail&item=i1')).toBe(true);
		// Exactly the one source/item separator pair — the destination didn't smuggle extras.
		expect(href.match(/&source=/g)).toHaveLength(1);
	});
});
