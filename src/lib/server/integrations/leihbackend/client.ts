import type { LeihbackendItem } from './mapping';

interface ItemPublicListResponse {
	page: number;
	perPage: number;
	totalItems: number;
	totalPages: number;
	items: LeihbackendItem[];
}

/** Thrown when fetching `item_public` from a leihbackend instance fails for any reason.
 *  The caller must treat the institution's pull as failed — no partial results. */
export class LeihbackendFetchError extends Error {
	readonly baseUrl: string;
	readonly status?: number;

	constructor(message: string, baseUrl: string, options?: { status?: number; cause?: unknown }) {
		super(message, { cause: options?.cause });
		this.name = 'LeihbackendFetchError';
		this.baseUrl = baseUrl;
		this.status = options?.status;
	}
}

const PER_PAGE = 200;
const MAX_ITEMS = 5000;
const TIMEOUT_MS = 15000;

/** Strips trailing slashes from a leihbackend base URL. */
export function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, '');
}

/**
 * Pages through `{base}/api/collections/item_public/records` until exhausted.
 * Throws `LeihbackendFetchError` on any non-2xx response, network error, timeout,
 * or if the result would exceed the 5000-item hard cap.
 */
export async function fetchAllItems(
	baseUrl: string,
	fetchFn: typeof fetch = fetch
): Promise<LeihbackendItem[]> {
	const base = normalizeBaseUrl(baseUrl);
	const items: LeihbackendItem[] = [];
	let page = 1;
	let totalPages = 1;

	do {
		const url = `${base}/api/collections/item_public/records?page=${page}&perPage=${PER_PAGE}`;

		let response: Response;
		try {
			response = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
		} catch (err) {
			throw new LeihbackendFetchError(`Request to ${url} failed: ${(err as Error).message}`, base, {
				cause: err,
			});
		}

		if (!response.ok) {
			throw new LeihbackendFetchError(`Unexpected status ${response.status} from ${url}`, base, {
				status: response.status,
			});
		}

		const data = (await response.json()) as ItemPublicListResponse;
		items.push(...data.items);

		if (items.length > MAX_ITEMS) {
			throw new LeihbackendFetchError(`${base} returned more than ${MAX_ITEMS} items`, base);
		}

		totalPages = data.totalPages;
		page += 1;
	} while (page <= totalPages);

	return items;
}

/**
 * Fetches a single `item_public` record by its leihbackend id.
 * Returns `null` if the record no longer exists (HTTP 404). Throws `LeihbackendFetchError`
 * on any other non-2xx response, network error, or timeout (treated as a transient failure).
 */
export async function fetchItemById(
	baseUrl: string,
	id: string,
	fetchFn: typeof fetch = fetch
): Promise<LeihbackendItem | null> {
	const base = normalizeBaseUrl(baseUrl);
	const url = `${base}/api/collections/item_public/records/${encodeURIComponent(id)}`;

	let response: Response;
	try {
		response = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
	} catch (err) {
		throw new LeihbackendFetchError(`Request to ${url} failed: ${(err as Error).message}`, base, {
			cause: err,
		});
	}

	if (response.status === 404) return null;

	if (!response.ok) {
		throw new LeihbackendFetchError(`Unexpected status ${response.status} from ${url}`, base, {
			status: response.status,
		});
	}

	return (await response.json()) as LeihbackendItem;
}
