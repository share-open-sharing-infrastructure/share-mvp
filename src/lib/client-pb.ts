import PocketBase from 'pocketbase';
import type { RecordModel, RecordSubscription, UnsubscribeFunc } from 'pocketbase';
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

// ---------------------------------------------------------------------------
// Resilient realtime subscriptions (issue #435)
// ---------------------------------------------------------------------------
//
// Two failure modes plagued the raw `pb.collection(x).subscribe(...)` calls:
//
//  1. "Invalid realtime client" (400). The SDK opens an SSE connection, gets a
//     clientId, then POSTs the subscription list. If that clientId is rejected
//     (a transient state on a cold/just-restarted backend, or a connection that
//     died between the two steps), the SDK gives up *permanently* on a first
//     attempt — it does NOT auto-retry (see connectErrorHandler: the
//     `!clientId && !reconnectAttempts` branch rejects instead of reconnecting).
//     Worse, a bare `subscribe()` without `.catch()` turns that rejection into
//     an "Uncaught (in promise)" error and a silently dead subscription.
//
//  2. Silent freezes on mobile. When a tab is backgrounded, mobile browsers
//     often suspend the SSE stream WITHOUT firing `onerror`, so the SDK never
//     notices and never reconnects. On resume the stream is dead — messages and
//     notifications stop updating in real time for that party.
//
// `subscribeRealtime` fixes both: it retries failed subscribes with backoff,
// keeps a registry of active subscriptions, and force-reconnects them when the
// network returns (`online`) or the tab is brought back to the foreground
// (`visibilitychange`). After a reconnect each subscription's optional
// `onReconnect` runs so callers can refetch state that changed while the stream
// was down (live events alone can't backfill the gap).

const MAX_SUBSCRIBE_RETRIES = 5;
const RETRY_BACKOFF_MS = [200, 500, 1000, 2000, 4000];
// Only force a reconnect on tab-foreground if the tab was backgrounded at least
// this long. Short hidden spells (alt-tabbing on desktop) don't kill the SSE
// stream, so reconnecting then would just thrash the connection and trigger
// needless onReconnect refetches. The mobile background-freeze we care about
// lasts far longer than this.
const RECONNECT_AFTER_HIDDEN_MS = 10_000;

export interface RealtimeSubscription<T = RecordModel> {
	/** Collection to subscribe to, e.g. 'notifications'. */
	collection: string;
	/** Record id or '*' for the whole collection (default '*'). */
	topic?: string;
	handler: (event: RecordSubscription<T>) => void;
	/**
	 * Runs after the connection is re-established following a drop. Use it to
	 * refetch anything that may have changed while the realtime stream was down.
	 */
	onReconnect?: () => void;
}

interface ActiveSub {
	collection: string;
	topic: string;
	handler: (event: RecordSubscription<unknown>) => void;
	onReconnect?: () => void;
	unsub?: UnsubscribeFunc;
	cancelled: boolean;
}

const activeSubs = new Set<ActiveSub>();
let recoveryListenersInstalled = false;
let hiddenSince: number | null = null;
let reestablishing = false;

async function attemptSubscribe(sub: ActiveSub, attempt = 0): Promise<void> {
	if (sub.cancelled) return;
	try {
		const unsub = await getClientPB().collection(sub.collection).subscribe(sub.topic, sub.handler);
		// The component may have unmounted while the connect was in flight.
		if (sub.cancelled) {
			unsub().catch(() => {});
			return;
		}
		sub.unsub = unsub;
	} catch (err) {
		if (sub.cancelled) return;
		if (attempt < MAX_SUBSCRIBE_RETRIES) {
			const delay = RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];
			setTimeout(() => attemptSubscribe(sub, attempt + 1), delay);
		} else {
			console.error(`Realtime subscription to "${sub.collection}" failed after retries:`, err);
		}
	}
}

async function reestablishAll(): Promise<void> {
	if (reestablishing || activeSubs.size === 0) return;
	reestablishing = true;
	try {
		// Tear the EventSource down so the next subscribe gets a fresh clientId —
		// the only reliable way to recover a stream the browser silently froze.
		try {
			getClientPB().realtime.unsubscribe();
		} catch {
			// Nothing connected — fine, we'll connect below.
		}
		for (const sub of activeSubs) {
			sub.unsub = undefined;
			await attemptSubscribe(sub);
		}
		for (const sub of activeSubs) {
			try {
				sub.onReconnect?.();
			} catch (err) {
				console.error('Realtime onReconnect handler failed:', err);
			}
		}
	} finally {
		reestablishing = false;
	}
}

function installRecoveryListeners(): void {
	if (recoveryListenersInstalled || typeof window === 'undefined') return;
	recoveryListenersInstalled = true;

	// Network came back after an outage — always a reason to re-establish.
	window.addEventListener('online', () => void reestablishAll());

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			hiddenSince = Date.now();
			return;
		}
		// Returning to the foreground: only reconnect if the tab was hidden long
		// enough that the SSE stream may have been frozen (see the threshold above).
		// A brief alt-tab leaves a healthy connection — don't thrash it.
		if (hiddenSince !== null) {
			const hiddenFor = Date.now() - hiddenSince;
			hiddenSince = null;
			if (hiddenFor >= RECONNECT_AFTER_HIDDEN_MS) void reestablishAll();
		}
	});
}

/**
 * Subscribe to PocketBase realtime with automatic retry on connect failure and
 * automatic recovery on network reconnect / tab foreground (see the block
 * comment above). Returns a cleanup function suitable for `$effect`/`onMount`.
 */
export function subscribeRealtime<T = RecordModel>(options: RealtimeSubscription<T>): () => void {
	const sub: ActiveSub = {
		collection: options.collection,
		topic: options.topic ?? '*',
		handler: options.handler as unknown as (event: RecordSubscription<unknown>) => void,
		onReconnect: options.onReconnect,
		cancelled: false
	};
	activeSubs.add(sub);
	installRecoveryListeners();
	void attemptSubscribe(sub);

	return () => {
		sub.cancelled = true;
		activeSubs.delete(sub);
		sub.unsub?.().catch(() => {});
	};
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
