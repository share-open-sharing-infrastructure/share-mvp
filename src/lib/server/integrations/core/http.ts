/**
 * Shared HTTP plumbing for the per-integration clients (leihbackend, WINBIAP).
 * Both previously defined identical copies of these — shared behavior changes
 * (e.g. a `retryable` flag on the error) now land once.
 */

/** Strips trailing slashes from an integration base URL. */
export function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, '');
}

/** Base for per-integration fetch errors: message, offending base URL, optional
 *  HTTP status and cause. Integrations extend it with only their `name` so
 *  `instanceof` checks per integration keep working. */
export class IntegrationFetchError extends Error {
	readonly baseUrl: string;
	readonly status?: number;

	constructor(message: string, baseUrl: string, options?: { status?: number; cause?: unknown }) {
		super(message, { cause: options?.cause });
		this.name = 'IntegrationFetchError';
		this.baseUrl = baseUrl;
		this.status = options?.status;
	}
}
