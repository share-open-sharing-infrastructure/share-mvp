import { describe, it, expect, vi } from 'vitest';
import { makeMockPb } from '$lib/test-utils/pocketbase';

const { TEST_ORIGIN } = vi.hoisted(() => ({ TEST_ORIGIN: 'https://marburg.example.org' }));

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_SITE_ORIGIN: TEST_ORIGIN },
}));

import { GET } from './+server';

const STATIC_PATHS = [
	'/',
	'/search',
	'/misc/about',
	'/misc/guide',
	'/misc/app',
	'/misc/contact',
	'/misc/imprint',
	'/misc/newsletter',
	'/auth/login',
];

describe('GET /sitemap.xml', () => {
	it('builds every <loc> from the configured origin, incl. all static paths', async () => {
		const pb = makeMockPb({
			items_searchable: {
				getFullList: vi
					.fn()
					.mockResolvedValue([{ id: 'item1', updated: '2024-01-02 10:00:00.000Z' }]),
			},
			users: {
				getFullList: vi
					.fn()
					.mockResolvedValue([{ id: 'user1', updated: '2024-03-04 11:00:00.000Z' }]),
			},
		});

		const response = await GET({ locals: { pb } } as never);
		const xml = await response.text();

		expect(response.headers.get('Content-Type')).toBe('application/xml');
		expect(response.headers.get('Cache-Control')).toBe('max-age=3600');

		for (const path of STATIC_PATHS) {
			expect(xml).toContain(`<loc>${TEST_ORIGIN}${path}</loc>`);
		}
		expect(xml).toContain(`<loc>${TEST_ORIGIN}/items/item1</loc>`);
		expect(xml).toContain('<lastmod>2024-01-02</lastmod>');
		expect(xml).toContain(`<loc>${TEST_ORIGIN}/users/user1</loc>`);
		expect(xml).toContain('<lastmod>2024-03-04</lastmod>');
	});

	it('reads items_searchable with the available-only filter, never the base items collection', async () => {
		const itemsGetFullList = vi.fn().mockResolvedValue([]);
		const pb = makeMockPb({
			items_searchable: { getFullList: itemsGetFullList },
			users: { getFullList: vi.fn().mockResolvedValue([]) },
		});

		await GET({ locals: { pb } } as never);

		expect(pb.collection).toHaveBeenCalledWith('items_searchable');
		expect(pb.collection).not.toHaveBeenCalledWith('items');
		expect(itemsGetFullList).toHaveBeenCalledWith(
			expect.objectContaining({ filter: 'status = "available"' })
		);
	});
});
