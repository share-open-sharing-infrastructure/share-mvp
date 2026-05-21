import PocketBase from 'pocketbase';
import { PUBLIC_PB_URL } from '$env/static/public';

let instance: PocketBase | null = null;

/**
 * Returns the shared client-side PocketBase instance. All client components
 * (root layout, conversations layout, conversation detail page) should use
 * this so subscriptions multiplex over a single EventSource.
 *
 * Auth state is injected by the root layout via syncClientPBAuth() using
 * the token passed in page data from the server — the auth cookie is httpOnly
 * and not readable by JavaScript.
 *
 * On the first instance creation we also register an authStore listener that
 * resets the realtime service whenever the *authenticated user* changes
 * (login / logout / user switch). Without this reset, PocketBase rejects the
 * next subscribe with 403 "The current and the previous request authorization
 * don't match" because the shared singleton would keep the same clientId
 * across the session and try to submit old subscriptions under the new auth.
 * Pure token refresh for the same user (server-side authRefresh in
 * hooks.server.ts rotates the JWT on every request) does not trigger a reset
 * because the record id is unchanged — avoids thrashing the connection.
 */
export function getClientPB(): PocketBase {
	if (!instance) {
		instance = new PocketBase(PUBLIC_PB_URL);

		let lastUserId: string | null = instance.authStore.record?.id ?? null;
		instance.authStore.onChange((_token, record) => {
			const newUserId = record?.id ?? null;
			if (newUserId !== lastUserId) {
				try {
					instance!.realtime.unsubscribe();
				} catch {
					// No-op if the realtime service was never connected.
				}
			}
			lastUserId = newUserId;
		});
	}
	return instance;
}

/**
 * Syncs the client PB auth state from server-passed data.
 * Called by the root layout on mount and on every navigation that refreshes
 * the layout load (which re-issues a fresh JWT via authRefresh).
 */
export function syncClientPBAuth(token: string | null, record: unknown): void {
	const pb = getClientPB();
	if (token && record) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		pb.authStore.save(token, record as any);
	} else {
		pb.authStore.clear();
	}
}
