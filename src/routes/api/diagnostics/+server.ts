// Fire-and-forget diagnostics endpoint called by the client on travel time failures.
// Events are written to the server log with a [TRAVEL_DIAG] prefix for easy grepping.
// Always returns 200 so client errors never cascade into visible UI failures.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const ipCounts = new Map<string, { count: number; resetAt: number }>();

export const POST: RequestHandler = async ({ request }) => {
	const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
	const now = Date.now();
	const entry = ipCounts.get(ip);
	if (entry && now < entry.resetAt) {
		if (entry.count >= RATE_LIMIT) return json({});
		entry.count++;
	} else {
		ipCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
	}

	const data = await request.json().catch(() => null);
	if (data?.event) {
		console.log('[TRAVEL_DIAG]', JSON.stringify({ ts: new Date().toISOString(), ...data }));
	}
	return json({});
};
