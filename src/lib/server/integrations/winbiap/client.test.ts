import { describe, it, expect, vi } from 'vitest';
import { fetchItemStatus, statusFromMediaItems, normalizeBaseUrl, WinbiapFetchError } from './client';

const BASE = 'https://rblg.stadt.lueneburg.de/webopac';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
	return { ok, status, json: () => Promise.resolve(body) } as Response;
}

/** A search response carrying a catalogue record with the given exemplar StatusIds. */
function hit(...statusIds: number[]) {
	return { Data: [{ CatalogData: { MediaItemsUnsorted: statusIds.map((StatusId) => ({ StatusId })) } }] };
}

describe('statusFromMediaItems', () => {
	it('is available when any exemplar is available (StatusId 1)', () => {
		expect(statusFromMediaItems([{ StatusId: 2 }, { StatusId: 1 }])).toBe('available');
	});

	it('is unavailable when all exemplars are entliehen/vorbestellt/Präsenz (2/3/100)', () => {
		expect(statusFromMediaItems([{ StatusId: 2 }, { StatusId: 100 }])).toBe('unavailable');
	});

	it('is unknown for an empty exemplar list', () => {
		expect(statusFromMediaItems([])).toBe('unknown');
		expect(statusFromMediaItems(undefined)).toBe('unknown');
	});

	it('is unknown for unrecognised StatusIds', () => {
		expect(statusFromMediaItems([{ StatusId: 99 }])).toBe('unknown');
	});
});

describe('fetchItemStatus', () => {
	it('builds a Job=Search / SearchCondition1=46 URL with the full encoded barcode + nostats', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse(hit(1)));

		const result = await fetchItemStatus(`${BASE}/`, '118$60449822', fetchFn);

		expect(result).toEqual({ found: true, status: 'available' });
		const url = fetchFn.mock.calls[0][0] as string;
		expect(url).toBe(
			`${BASE}/service/cataloguedata.aspx?json=1&Job=Search&SearchCondition1=46&SearchValue1=118%2460449822&nostats=1`
		);
	});

	it('sends a browser User-Agent and a Referer of the base root', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse(hit(1)));

		await fetchItemStatus(BASE, '118$1', fetchFn);

		const init = fetchFn.mock.calls[0][1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers['User-Agent']).toContain('Mozilla');
		expect(headers.Referer).toBe(`${BASE}/`);
	});

	it('reports not found when Data is empty', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ Data: [] }));

		await expect(fetchItemStatus(BASE, '118$1', fetchFn)).resolves.toEqual({ found: false });
	});

	it("retries with '+' left literal when an encoded barcode containing '+' misses", async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ Data: [] })) // first (encoded %2B) → miss
			.mockResolvedValueOnce(jsonResponse(hit(2))); // fallback (literal +) → hit

		const result = await fetchItemStatus(BASE, '118$6029495+', fetchFn);

		expect(result).toEqual({ found: true, status: 'unavailable' });
		expect(fetchFn).toHaveBeenCalledTimes(2);
		expect(fetchFn.mock.calls[0][0]).toContain('SearchValue1=118%246029495%2B');
		expect(fetchFn.mock.calls[1][0]).toContain('SearchValue1=118%246029495+');
	});

	it('throws WinbiapFetchError on a non-2xx response', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, false, 503));

		await expect(fetchItemStatus(BASE, '118$1', fetchFn)).rejects.toThrow(WinbiapFetchError);
	});

	it('throws WinbiapFetchError on a network error', async () => {
		const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

		await expect(fetchItemStatus(BASE, '118$1', fetchFn)).rejects.toThrow(WinbiapFetchError);
	});

	it('throws WinbiapFetchError on an unexpected body lacking a Data array', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ maintenance: true }));

		await expect(fetchItemStatus(BASE, '118$1', fetchFn)).rejects.toThrow(WinbiapFetchError);
	});
});

describe('normalizeBaseUrl', () => {
	it('strips trailing slashes', () => {
		expect(normalizeBaseUrl(`${BASE}//`)).toBe(BASE);
	});
});
