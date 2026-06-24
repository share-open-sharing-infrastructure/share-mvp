import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Proxy the pocketbase backend export (GET /api/account/export) and stream it back as a file
// download. Keeps the auth token server-side; the client just hits this route.
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401);

	let payload: unknown;
	try {
		payload = await locals.pb.send('/api/account/export', { method: 'GET' });
	} catch (err) {
		console.error('Data export failed', err);
		error(500, 'export_failed');
	}

	return new Response(JSON.stringify(payload, null, 2), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': 'attachment; filename="allerleih-meine-daten.json"',
			'Cache-Control': 'no-store',
		},
	});
};
