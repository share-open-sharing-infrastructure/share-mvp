import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const data = await request.json().catch(() => null);
	if (data?.event) console.log('[TRAVEL_DIAG]', JSON.stringify({ ts: new Date().toISOString(), ...data }));
	return json({});
};
