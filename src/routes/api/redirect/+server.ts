import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const to = url.searchParams.get('to');
	const source = url.searchParams.get('source') ?? 'unknown';
	const itemId = url.searchParams.get('item') ?? null;

	if (!to) throw error(400, 'Missing destination');

	// signalLink is user-supplied — block non-https to prevent open-redirect abuse
	if (!to.startsWith('https://')) throw error(400, 'Only https destinations allowed');

	locals.pb
		.collection('outbound_clicks')
		.create({
			destination: to,
			source_page: source,
			item: itemId ?? undefined,
		})
		.catch(() => {});

	throw redirect(302, to);
};
