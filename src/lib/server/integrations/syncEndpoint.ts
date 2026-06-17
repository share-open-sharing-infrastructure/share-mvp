import { json, error, type RequestHandler } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import type PocketBase from 'pocketbase';
import { SYNC_SECRET, PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD } from '$env/static/private';
import { getSuperuserClient } from './core/pocketbase';
import type { SyncSummary } from './core/types';

/** Constant-time check that the request carries `Authorization: Bearer $SYNC_SECRET`. */
function isAuthorized(request: Request): boolean {
	const header = request.headers.get('authorization') ?? '';
	const expected = `Bearer ${SYNC_SECRET}`;

	const headerBuf = Buffer.from(header);
	const expectedBuf = Buffer.from(expected);
	if (headerBuf.length !== expectedBuf.length) return false;

	return timingSafeEqual(headerBuf, expectedBuf);
}

/**
 * Builds the shared request handler behind the bearer-secret-protected integration endpoints
 * (`/api/sync`, `/api/refresh`). Verifies configuration + authorization, obtains the superuser
 * client, runs `runner`, logs one `[label] …` line per institution summary, and returns the JSON.
 *
 * @param label - Log prefix, e.g. 'sync' or 'refresh'.
 * @param runner - Produces the per-institution summaries from an authenticated superuser client.
 *   Receives the request `URL` so handlers can read query params (e.g. `?institution=<id>`).
 */
export function makeSyncHandler(
	label: string,
	runner: (pb: PocketBase, url: URL) => Promise<SyncSummary[]>
): RequestHandler {
	return async ({ request, url }) => {
		if (!SYNC_SECRET || !PB_SUPERUSER_EMAIL || !PB_SUPERUSER_PASSWORD) {
			error(503, 'Sync is not configured.');
		}

		if (!isAuthorized(request)) {
			error(401, 'Unauthorized');
		}

		const pb = await getSuperuserClient().catch((): never =>
			error(503, 'Sync unavailable: superuser authentication failed.')
		);

		const summaries = await runner(pb, url);

		for (const summary of summaries) {
			const line =
				`[${label}] ${summary.institution}: fetched=${summary.fetched} created=${summary.created} ` +
				`updated=${summary.updated} archived=${summary.archived} skipped=${summary.skipped} ` +
				`errors=${summary.errors.length} (${summary.durationMs}ms)`;
			if (summary.errors.length > 0) {
				console.error(line, summary.errors);
			} else {
				console.log(line);
			}
		}

		return json({ summaries });
	};
}
