import { json, error } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from './$types';
import { SYNC_SECRET, PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD } from '$env/static/private';
import { getSuperuserClient, syncAll } from '$lib/server/leihbackend/sync';

function isAuthorized(request: Request): boolean {
	const header = request.headers.get('authorization') ?? '';
	const expected = `Bearer ${SYNC_SECRET}`;

	const headerBuf = Buffer.from(header);
	const expectedBuf = Buffer.from(expected);
	if (headerBuf.length !== expectedBuf.length) return false;

	return timingSafeEqual(headerBuf, expectedBuf);
}

/** Triggers a leihbackend sync for all configured institutions. Called by an Uberspace cron job every 15 min. */
export const POST: RequestHandler = async ({ request }) => {
	if (!SYNC_SECRET || !PB_SUPERUSER_EMAIL || !PB_SUPERUSER_PASSWORD) {
		error(503, 'Sync is not configured.');
	}

	if (!isAuthorized(request)) {
		error(401, 'Unauthorized');
	}

	let pb;
	try {
		pb = await getSuperuserClient();
	} catch {
		error(503, 'Sync unavailable: superuser authentication failed.');
	}

	const summaries = await syncAll(pb);

	for (const summary of summaries) {
		const line =
			`[sync] ${summary.institution}: fetched=${summary.fetched} created=${summary.created} ` +
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
