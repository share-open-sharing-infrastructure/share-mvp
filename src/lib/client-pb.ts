import PocketBase from 'pocketbase';
import { PUBLIC_PB_URL } from '$env/static/public';

let instance: PocketBase | null = null;
let lastCookie = '';

/**
 * Returns the shared client-side PocketBase instance. All client components
 * (root layout, conversations layout, conversation detail page) should use
 * this so subscriptions multiplex over a single EventSource.
 *
 * Re-reads the auth cookie if it has changed since the last call, so the
 * singleton's authStore stays in sync with server-issued Set-Cookie headers
 * without requiring explicit re-plumbing on login/logout.
 */
export function getClientPB(): PocketBase {
	if (!instance) {
		instance = new PocketBase(PUBLIC_PB_URL);
	}
	const current = (typeof document !== 'undefined' ? document.cookie : '') || '';
	if (current !== lastCookie) {
		instance.authStore.loadFromCookie(current);
		lastCookie = current;
	}
	return instance;
}
