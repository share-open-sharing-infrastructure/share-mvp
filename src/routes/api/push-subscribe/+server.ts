import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	upsertPushSubscription,
	deletePushSubscription,
	type PostPayload,
} from '$lib/server/pushSubscriptions';

interface DeletePayload {
	endpoint: string;
}

/** Store or refresh a push subscription for the authenticated user. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const payload: PostPayload = await request.json();
	if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
		error(400, 'Invalid subscription payload');
	}

	await upsertPushSubscription(locals.pb, locals.user.id, payload);
	return json({ ok: true });
};

/** Remove a push subscription (e.g. when the user disables notifications). */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const payload: DeletePayload = await request.json();
	if (!payload.endpoint) error(400, 'Missing endpoint');

	await deletePushSubscription(locals.pb, locals.user.id, payload.endpoint);
	return json({ ok: true });
};
