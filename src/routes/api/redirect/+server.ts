import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Messenger deep links are personal contact data (a Signal handle or Telegram
// username), and for trustees-only handles they are outright private. They must
// never be persisted to outbound_clicks, which only exists to track outbound
// links to partner/institution offers (issue #520). We recognise them by the
// `conversation` source (the only messenger caller) and, as defence-in-depth
// against a hand-crafted source param, by destination host.
const MESSENGER_HOSTS = new Set([
	't.me',
	'telegram.me',
	'signal.me',
	'signal.group',
]);

function isMessengerClick(source: string, to: string): boolean {
	if (source === 'conversation') return true;
	try {
		const host = new URL(to).hostname.toLowerCase().replace(/^www\./, '');
		return MESSENGER_HOSTS.has(host);
	} catch {
		// Unparseable destination — err on the side of not logging.
		return true;
	}
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const to = url.searchParams.get('to');
	const source = url.searchParams.get('source') ?? 'unknown';
	const itemId = url.searchParams.get('item') ?? null;

	if (!to) throw error(400, 'Missing destination');

	// signalLink is user-supplied — block non-https to prevent open-redirect abuse
	if (!to.startsWith('https://'))
		throw error(400, 'Only https destinations allowed');

	if (!isMessengerClick(source, to)) {
		locals.pb
			.collection('outbound_clicks')
			.create({
				destination: to,
				source_page: source,
				item: itemId ?? undefined,
			})
			.catch(() => {});
	}

	throw redirect(302, to);
};
