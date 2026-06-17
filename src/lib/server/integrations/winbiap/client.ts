import type { Item } from '$lib/types/models';

type ItemStatus = Item['status']; // 'available' | 'unavailable' | 'unknown'

/** Thrown when a WINBIAP WebOPAC request fails (network, non-2xx, or an unexpected body).
 *  Treated as a transient failure by the refresh flow — the item is left untouched. */
export class WinbiapFetchError extends Error {
	readonly baseUrl: string;
	readonly status?: number;

	constructor(message: string, baseUrl: string, options?: { status?: number; cause?: unknown }) {
		super(message, { cause: options?.cause });
		this.name = 'WinbiapFetchError';
		this.baseUrl = baseUrl;
		this.status = options?.status;
	}
}

const TIMEOUT_MS = 10000;

// Mediennummer search condition code (see docs/winbiap_api-search.pdf §5.1.1).
const SEARCH_CONDITION_MEDIENNUMMER = 46;

// Exemplar StatusIds that count as "not lendable right now" (entliehen / vorbestellt / Präsenz).
const UNAVAILABLE_STATUS_IDS = new Set([2, 3, 100]);
const AVAILABLE_STATUS_ID = 1;

const BROWSER_HEADERS = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
	Accept: '*/*',
};

interface MediaItem {
	StatusId?: number;
}

interface CatalogueRecord {
	CatalogData?: { MediaItemsUnsorted?: MediaItem[] };
}

interface SearchResponse {
	Data?: CatalogueRecord[];
}

/** Strips trailing slashes from a WebOPAC base URL. */
export function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, '');
}

/**
 * Derives an AllerLeih status from a catalogue record's exemplar list, per the proven script:
 * any exemplar available ⇒ `available`; a non-empty list all entliehen/vorbestellt/Präsenz ⇒
 * `unavailable`; anything else (empty, or mixed/unknown StatusIds) ⇒ `unknown`.
 */
export function statusFromMediaItems(mediaItems: MediaItem[] | undefined): ItemStatus {
	const ids = (mediaItems ?? []).map((item) => item.StatusId);
	if (ids.length === 0) return 'unknown';
	if (ids.some((id) => id === AVAILABLE_STATUS_ID)) return 'available';
	if (ids.every((id) => id !== undefined && UNAVAILABLE_STATUS_IDS.has(id))) return 'unavailable';
	return 'unknown';
}

function buildSearchUrl(base: string, barcode: string, encodePlus: boolean): string {
	// encodeURIComponent percent-encodes '$' and '+'. Some WebOPAC servers treat '%2B' and a
	// literal '+' differently, so the caller can retry with '+' left literal (see fetchItemStatus).
	let value = encodeURIComponent(barcode);
	if (!encodePlus) value = value.replace(/%2B/g, '+');
	return `${base}/service/cataloguedata.aspx?json=1&Job=Search&SearchCondition1=${SEARCH_CONDITION_MEDIENNUMMER}&SearchValue1=${value}&nostats=1`;
}

async function requestSearch(url: string, base: string, fetchFn: typeof fetch): Promise<SearchResponse> {
	let response: Response;
	try {
		response = await fetchFn(url, {
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { ...BROWSER_HEADERS, Referer: `${base}/` },
		});
	} catch (err) {
		throw new WinbiapFetchError(`Request to ${url} failed: ${(err as Error).message}`, base, { cause: err });
	}

	if (!response.ok) {
		throw new WinbiapFetchError(`Unexpected status ${response.status} from ${url}`, base, {
			status: response.status,
		});
	}

	const body = (await response.json()) as SearchResponse;
	// A well-formed response always carries a `Data` array; its absence means an unexpected body
	// (e.g. a maintenance page) — treat as transient rather than "item gone".
	if (!Array.isArray(body.Data)) {
		throw new WinbiapFetchError(`Response from ${url} has no Data array`, base);
	}
	return body;
}

/**
 * Looks up one item's current availability in a WINBIAP WebOPAC by its full barcode
 * (e.g. `118$5031208P`), via `Job=Search&SearchCondition1=46`.
 *
 * @returns `{ found: false }` when the catalogue has no such item (→ archive), or
 *          `{ found: true, status }` with the derived availability.
 * @throws `WinbiapFetchError` on network/non-2xx/unexpected-body failures (→ transient, leave as-is).
 */
export async function fetchItemStatus(
	baseUrl: string,
	barcode: string,
	fetchFn: typeof fetch = fetch
): Promise<{ found: false } | { found: true; status: ItemStatus }> {
	const base = normalizeBaseUrl(baseUrl);

	let body = await requestSearch(buildSearchUrl(base, barcode, true), base, fetchFn);

	// Fallback: barcodes containing '+' sometimes only match with '+' sent literally.
	if (body.Data!.length === 0 && barcode.includes('+')) {
		body = await requestSearch(buildSearchUrl(base, barcode, false), base, fetchFn);
	}

	const record = body.Data![0];
	if (!record) return { found: false };

	return { found: true, status: statusFromMediaItems(record.CatalogData?.MediaItemsUnsorted) };
}
