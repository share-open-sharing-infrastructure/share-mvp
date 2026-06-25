import { describe, it, expect } from 'vitest';
import { itemImageUrl } from './utils';

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
