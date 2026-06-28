import PocketBase from 'pocketbase';
import { PUBLIC_PB_URL } from '$env/static/public';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import { getOutstandingLegalDocs, isLegalLocked, type LegalUser } from '$lib/server/legal';
import { getActiveLegalVersions } from '$lib/server/legalDocs';

export { PUBLIC_PB_URL };

const unprotectedPrefix = [
	'/auth/login',
	'/auth/register',
	'/auth/reset',
	'/auth/account-deleted',
	'/search',
	'/items',
	'/users',
	'/misc',
	'/invite',
	'/sitemap.xml',
	'/api/redirect',
	'/api/diagnostics',
];

// Paths exempt from the legal-consent gate (Issue #399) — otherwise a not-yet-
// consented user would be redirected away from the very pages they need: the
// accept/locked pages, the auth flow (incl. logout), the readable legal docs
// under /misc, and the fire-and-forget diagnostics/redirect endpoints.
const legalGateExempt = ['/legal', '/auth', '/misc', '/api/diagnostics', '/api/redirect'];

export const authentication: Handle = async ({ event, resolve }) => {
	event.locals.pb = new PocketBase(PUBLIC_PB_URL);

	event.locals.pb.authStore.loadFromCookie(
		event.request.headers.get('cookie') || ''
	);

	try {
		if (event.locals.pb.authStore.isValid) {
			await event.locals.pb.collection('users').authRefresh();
			const record = event.locals.pb.authStore.record;
			// Defense-in-depth: a deleted (anonymized) account must never be treated as
			// logged in, even if a stale cookie survives. The backend also rejects auth
			// for these accounts (see allerleih-backend/pb_hooks/account.pb.js).
			if (record?.deleted) {
				event.locals.pb.authStore.clear();
				event.locals.user = null;
			} else {
				event.locals.user = record;
			}
		} else {
			event.locals.user = null;
		}
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (_) {
		event.locals.pb.authStore.clear();
		event.locals.user = null;
	}

	const response = await resolve(event);

	response.headers.append(
		'set-cookie',
		event.locals.pb.authStore.exportToCookie({
			httpOnly: true,
			secure: !event.url.hostname.includes('localhost'),
			sameSite: 'Lax',
		})
	);

	return response;
};

export const authorization: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const loggedIn = event.locals.pb.authStore.isValid;

	if (!unprotectedPrefix.some((path) => pathname.startsWith(path)) && pathname !== '/') {
		if (!loggedIn) {
			redirect(307, `/auth/login?redirectTo=${encodeURIComponent(pathname + event.url.search)}`);
		}
	}

	// Legal-consent gate (Issue #399): a logged-in user who declined the current
	// terms is locked; one who hasn't accepted the current ToS/privacy version is
	// sent to accept them. The accepted versions come from the auth record; the
	// active versions are read from `legal_documents` but cached in-process (~60s),
	// so this stays cheap. Exempt paths above keep the gate from trapping its own pages.
	if (loggedIn && event.locals.user && !legalGateExempt.some((p) => pathname.startsWith(p))) {
		const user = event.locals.user as unknown as LegalUser;
		if (isLegalLocked(user)) {
			redirect(307, '/legal/locked');
		}
		const activeVersions = await getActiveLegalVersions(event.locals.pb);
		if (getOutstandingLegalDocs(user, activeVersions).length > 0) {
			redirect(307, `/legal/accept?redirectTo=${encodeURIComponent(pathname + event.url.search)}`);
		}
	}

	const result = await resolve(event);
	return result;
};

export const handle = sequence(authentication, authorization);

// TODO: Check if this is used anywhere implicitly
export function handleError({ error, event }): void {
	console.error('Error occurred during request processing:', {
		error,
		url: event.url.href,
		method: event.request.method,
	});
}
