import { describe, it, expect, vi } from 'vitest';
import { makeMockPb } from '$lib/test-utils/pocketbase';

const { TEST_ORIGIN, NEWSLETTER_URL } = vi.hoisted(() => ({
	TEST_ORIGIN: 'https://marburg.example.org',
	NEWSLETTER_URL: 'https://app.keila.io/forms/nfrm_b94Bj5RD',
}));

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_SITE_ORIGIN: TEST_ORIGIN, PUBLIC_NEWSLETTER_FORM_URL: NEWSLETTER_URL },
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

// Class D (share-mvp#631): the top-level `vi.mock` above fixes the env for every test in this
// file, so the "unconfigured" case needs its own module-reset + dynamic re-import, same as
// `instance.test.ts`'s "env var wiring" block.
describe('GET /sitemap.xml — PUBLIC_NEWSLETTER_FORM_URL unset', () => {
	it('omits /misc/newsletter, without matching /misc/newsletter/thanks or similar', async () => {
		vi.resetModules();
		vi.doMock('$env/dynamic/public', () => ({ env: { PUBLIC_SITE_ORIGIN: TEST_ORIGIN } }));

		const { GET: getUnconfigured } = await import('./+server');
		const pb = makeMockPb({
			items_searchable: { getFullList: vi.fn().mockResolvedValue([]) },
			users: { getFullList: vi.fn().mockResolvedValue([]) },
		});

		const response = await getUnconfigured({ locals: { pb } } as never);
		const xml = await response.text();

		// `<` right after the path (not `/`) rules out this also matching a hypothetical
		// `/misc/newsletter/thanks` entry.
		expect(xml).not.toContain(`<loc>${TEST_ORIGIN}/misc/newsletter<`);

		vi.doUnmock('$env/dynamic/public');
		vi.resetModules();
	});
});
