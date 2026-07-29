import type { RecordModel, RecordSubscription, UnsubscribeFunc } from 'pocketbase';
import { getClientPB } from '$lib/client-pb';

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
// needless onReconnect refetches. Lowered (#528) because on mobile the stream
// dies far more readily than the old 10 s window assumed — a phone can freeze
// the SSE within a couple of seconds of being backgrounded.
const RECONNECT_AFTER_HIDDEN_MS = 3_000;

// Foreground liveness watchdog (#528). The `online` / `visibilitychange` /
// `pageshow` listeners below only recover when the browser *tells* us something
// changed. On mobile the SSE connection can freeze silently (WLAN↔cellular
// handover, carrier idle timeout) WITHOUT firing any of those, so a chat stops
// updating with no event to hang recovery off. This interval polls the
// connection while the tab is visible and force-reconnects when it is provably
// dead — either the SDK reports the socket is down, or no realtime traffic has
// arrived for REALTIME_STALE_MS on a subscription that expects a steady stream.
const WATCHDOG_INTERVAL_MS = 15_000;
// A subscription flagged `expectsHeartbeat` is on a page that pushes a periodic
// self-update echoed back over SSE (the chat-detail 15 s presence ping), so a
// healthy stream produces an event at least every ~15 s. If none has arrived in
// this long, the stream is almost certainly frozen. Must comfortably exceed the
// heartbeat period so a single missed echo doesn't trigger a needless reconnect.
const REALTIME_STALE_MS = 40_000;

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
	/**
	 * Set true for subscriptions whose page emits a periodic self-update that is
	 * echoed back over SSE (e.g. the chat-detail presence heartbeat). Only such a
	 * subscription enables the watchdog's staleness check — on a page without a
	 * heartbeat (sidebar/notifications only) a quiet stream is normal, not frozen,
	 * so the staleness path would thrash. See the watchdog block above.
	 */
	expectsHeartbeat?: boolean;
}

interface ActiveSub {
	collection: string;
	topic: string;
	handler: (event: RecordSubscription<unknown>) => void;
	onReconnect?: () => void;
	expectsHeartbeat?: boolean;
	unsub?: UnsubscribeFunc;
	cancelled: boolean;
}

const activeSubs = new Set<ActiveSub>();
let recoveryListenersInstalled = false;
let hiddenSince: number | null = null;
let reestablishing = false;
// Timestamp (ms) of the last realtime activity: an incoming event or a
// successful (re)connect. The watchdog compares this against REALTIME_STALE_MS
// to detect a silently frozen SSE stream. Seeded on every successful subscribe.
let lastRealtimeActivityAt = 0;

function markRealtimeActivity(): void {
	lastRealtimeActivityAt = Date.now();
}

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
		// A fresh connection is itself activity — seed the watchdog clock so a
		// just-opened subscription isn't judged stale before its first event.
		markRealtimeActivity();
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
		// Iterate over a snapshot: navigating between conversations during an
		// `await` below mutates `activeSubs` (a cancelled sub is removed, a new one
		// added), which would otherwise disrupt live-set iteration.
		const subs = [...activeSubs];
		for (const sub of subs) {
			sub.unsub = undefined;
			await attemptSubscribe(sub);
		}
		// A successful reconnect counts as activity — reset the watchdog clock so
		// it doesn't immediately fire again on the same staleness it just cleared.
		markRealtimeActivity();
		for (const sub of subs) {
			// A sub cancelled while the reconnect was in flight (component unmounted /
			// navigated away) must not run its onReconnect — a stale invalidateAll()
			// would refetch data nothing is showing. Same skip as attemptSubscribe.
			if (sub.cancelled) continue;
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

	// bfcache restore (back/forward navigation) resumes a page whose SSE stream
	// was torn down while it was in the cache; `persisted` marks that path. It
	// does not always fire `visibilitychange`, so recover explicitly here (#528).
	window.addEventListener('pageshow', (e) => {
		if (e.persisted) void reestablishAll();
	});

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

	// Liveness watchdog (#528): the listeners above only fire when the browser
	// reports a change, but a mobile SSE stream can freeze silently. Poll while
	// the tab is visible and force a reconnect when the connection is provably
	// dead. Runs once (guarded by recoveryListenersInstalled) so the interval is
	// never duplicated.
	setInterval(() => {
		if (document.visibilityState !== 'visible' || activeSubs.size === 0) return;
		// Always trust the SDK when it says the socket is down.
		if (getClientPB().realtime.isConnected === false) {
			void reestablishAll();
			return;
		}
		// Otherwise fall back to staleness — but only for a subscription that
		// expects a steady heartbeat, so quiet-by-design pages don't thrash.
		const stale = Date.now() - lastRealtimeActivityAt > REALTIME_STALE_MS;
		if (stale && [...activeSubs].some((s) => s.expectsHeartbeat)) {
			void reestablishAll();
		}
	}, WATCHDOG_INTERVAL_MS);
}

/**
 * Subscribe to PocketBase realtime with automatic retry on connect failure and
 * automatic recovery on network reconnect / tab foreground (see the block
 * comment above). Returns a cleanup function suitable for `$effect`/`onMount`.
 */
export function subscribeRealtime<T = RecordModel>(options: RealtimeSubscription<T>): () => void {
	const userHandler = options.handler as unknown as (event: RecordSubscription<unknown>) => void;
	const sub: ActiveSub = {
		collection: options.collection,
		topic: options.topic ?? '*',
		// Wrap the caller's handler so every incoming event refreshes the watchdog
		// clock — a live event is the strongest possible proof the stream is alive.
		handler: (event) => {
			markRealtimeActivity();
			userHandler(event);
		},
		onReconnect: options.onReconnect,
		expectsHeartbeat: options.expectsHeartbeat,
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

