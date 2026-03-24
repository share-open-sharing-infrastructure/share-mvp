import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Store or refresh a push subscription for the authenticated user. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const { endpoint, keys } = await request.json();
	if (!endpoint || !keys?.p256dh || !keys?.auth) {
		error(400, 'Invalid subscription payload');
	}

	// Upsert: if endpoint already exists, update it; otherwise create
	const existing = await locals.pb
		.collection('push_subscriptions')
		.getList(1, 1, { filter: `endpoint="${endpoint}"` })
		.catch(() => ({ items: [] }));

	if (existing.items.length > 0) {
		await locals.pb.collection('push_subscriptions').update(existing.items[0].id, {
			user: locals.user.id,
			p256dh: keys.p256dh,
			auth: keys.auth,
		});
	} else {
		await locals.pb.collection('push_subscriptions').create({
			user: locals.user.id,
			endpoint,
			p256dh: keys.p256dh,
			auth: keys.auth,
		});
	}

	return json({ ok: true });
};

/** Remove a push subscription (e.g. when user disables notifications). */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const { endpoint } = await request.json();
	if (!endpoint) {
		error(400, 'Missing endpoint');
	}

	const existing = await locals.pb
		.collection('push_subscriptions')
		.getList(1, 1, { filter: `endpoint="${endpoint}" && user="${locals.user.id}"` })
		.catch(() => ({ items: [] }));

	if (existing.items.length > 0) {
		await locals.pb.collection('push_subscriptions').delete(existing.items[0].id);
	}

	return json({ ok: true });
};
