// Fire-and-forget diagnostics endpoint called by the client on travel time failures.
// Events are written to the server log with a [TRAVEL_DIAG] prefix for easy grepping.
// Always returns 200 so client errors never cascade into visible UI failures.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const data = await request.json().catch(() => null);
	if (data?.event) {
		console.log('[TRAVEL_DIAG]', JSON.stringify({ ts: new Date().toISOString(), ...data }));
	}
	return json({});
};
