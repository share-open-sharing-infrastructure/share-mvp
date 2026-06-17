import { describe, it, expect, vi } from 'vitest';
import { fetchAllItems, normalizeBaseUrl, LeihbackendFetchError } from './client';
import type { LeihbackendItem } from './mapping';

function makeItem(id: string): LeihbackendItem {
	return {
		id,
		iid: 1,
		name: `Item ${id}`,
		description: '',
		status: 'instock',
		deposit: 0,
		images: [],
		synonyms: '',
		category: [],
		brand: '',
		model: '',
		packaging: '',
		manual: '',
		parts: 1,
		copies: 1,
		added_on: '2026-01-01 00:00:00.000Z',
		is_protected: false,
	};
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
	return {
		ok,
		status,
		json: () => Promise.resolve(body),
	} as Response;
}

describe('normalizeBaseUrl', () => {
	it('strips a single trailing slash', () => {
		expect(normalizeBaseUrl('https://allerlei.uber.space/')).toBe('https://allerlei.uber.space');
	});

	it('strips multiple trailing slashes', () => {
		expect(normalizeBaseUrl('https://allerlei.uber.space///')).toBe('https://allerlei.uber.space');
	});

	it('is idempotent for urls without a trailing slash', () => {
		expect(normalizeBaseUrl('https://allerlei.uber.space')).toBe('https://allerlei.uber.space');
	});
});

describe('fetchAllItems', () => {
	it('returns all items from a single page', async () => {
		const fetchFn = vi.fn().mockResolvedValue(
			jsonResponse({ page: 1, perPage: 200, totalItems: 2, totalPages: 1, items: [makeItem('a'), makeItem('b')] })
		);

		const items = await fetchAllItems('https://allerlei.uber.space', fetchFn);

		expect(items.map((i) => i.id)).toEqual(['a', 'b']);
		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect(fetchFn).toHaveBeenCalledWith(
			'https://allerlei.uber.space/api/collections/item_public/records?page=1&perPage=200',
			expect.anything()
		);
	});

	it('paginates across multiple pages and concatenates results', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ page: 1, perPage: 200, totalItems: 3, totalPages: 2, items: [makeItem('a'), makeItem('b')] })
			)
			.mockResolvedValueOnce(
				jsonResponse({ page: 2, perPage: 200, totalItems: 3, totalPages: 2, items: [makeItem('c')] })
			);

		const items = await fetchAllItems('https://allerlei.uber.space', fetchFn);

		expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
		expect(fetchFn).toHaveBeenCalledTimes(2);
		expect(fetchFn.mock.calls[0][0]).toContain('page=1');
		expect(fetchFn.mock.calls[1][0]).toContain('page=2');
	});

	it('normalizes the base URL before building requests', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValue(jsonResponse({ page: 1, perPage: 200, totalItems: 0, totalPages: 1, items: [] }));

		await fetchAllItems('https://allerlei.uber.space/', fetchFn);

		expect(fetchFn.mock.calls[0][0]).toBe(
			'https://allerlei.uber.space/api/collections/item_public/records?page=1&perPage=200'
		);
	});

	it('throws LeihbackendFetchError on a non-2xx response', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));

		await expect(fetchAllItems('https://allerlei.uber.space', fetchFn)).rejects.toThrow(LeihbackendFetchError);
	});

	it('throws LeihbackendFetchError on a network error', async () => {
		const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

		await expect(fetchAllItems('https://allerlei.uber.space', fetchFn)).rejects.toThrow(LeihbackendFetchError);
	});

	it('throws LeihbackendFetchError on a timeout (AbortError)', async () => {
		const abortError = new DOMException('The operation was aborted.', 'AbortError');
		const fetchFn = vi.fn().mockRejectedValue(abortError);

		await expect(fetchAllItems('https://allerlei.uber.space', fetchFn)).rejects.toThrow(LeihbackendFetchError);
	});

	it('throws LeihbackendFetchError if the item count exceeds the 5000 cap', async () => {
		const page1Items = Array.from({ length: 200 }, (_, i) => makeItem(`p1-${i}`));
		const fetchFn = vi.fn().mockImplementation((url: string) => {
			const page = Number(new URL(url).searchParams.get('page'));
			return Promise.resolve(
				jsonResponse({
					page,
					perPage: 200,
					totalItems: 6000,
					totalPages: 30,
					items: page1Items.map((item) => ({ ...item, id: `${item.id}-page${page}` })),
				})
			);
		});

		await expect(fetchAllItems('https://allerlei.uber.space', fetchFn)).rejects.toThrow(LeihbackendFetchError);
	});
});
