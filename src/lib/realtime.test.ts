import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// client-pb.ts (imported by realtime.ts) reads PUBLIC_PB_URL from here via $lib/publicEnv's
// pbUrl(), at call time. Vitest bakes $env/dynamic/* at transform time, so vi.mock is the only
// way to control it (process.env / vi.stubEnv do not reach the module).
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_PB_URL: 'http://localhost:8090' } }));

// A hoisted holder collects every PocketBase instance the module constructs, so
// a test can reach the singleton created lazily by getClientPB().
const hoisted = vi.hoisted(() => ({ instances: [] as MockPB[] }));

// Minimal mock of the PocketBase client surface realtime.ts + client-pb.ts touch: authStore
// (for the onChange reset registered in getClientPB), realtime.isConnected /
// unsubscribe (the watchdog + reestablishAll), and collection().subscribe.
class MockPB {
	authStore = { record: null as unknown, onChange: vi.fn(), save: vi.fn(), clear: vi.fn() };
	realtime = { isConnected: true, unsubscribe: vi.fn() };
	// Every wrapped handler passed to subscribe, newest last — a test fires the
	// last one to simulate an incoming realtime event (which marks activity).
	handlers: Array<(event: unknown) => void> = [];
	subscribe = vi.fn(async (_topic: string, handler: (event: unknown) => void) => {
		this.handlers.push(handler);
		return vi.fn(async () => {});
	});
	collection = vi.fn(() => ({ subscribe: this.subscribe }));
	constructor() {
		hoisted.instances.push(this);
	}
}

vi.mock('pocketbase', () => ({ default: MockPB }));

// Mirror the module's own constants so assertions read intently (kept in sync
// with realtime.ts by hand — they are private there).
const WATCHDOG_INTERVAL_MS = 15_000;
const REALTIME_STALE_MS = 40_000;
const RECONNECT_AFTER_HIDDEN_MS = 3_000;

// Captured window/document event listeners, keyed by event type.
let listeners: Record<string, Array<(event?: unknown) => void>>;

function fire(type: string, event?: unknown): void {
	(listeners[type] ?? []).forEach((cb) => cb(event));
}

// Drain the microtask chain of an event-triggered reestablishAll (which awaits
// attemptSubscribe → subscribe). Microtasks run even under fake timers.
async function flush(): Promise<void> {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

async function importModule() {
	return import('./realtime');
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.resetModules();
	hoisted.instances.length = 0;
	listeners = {};
	const addEventListener = (type: string, cb: (event?: unknown) => void) => {
		(listeners[type] ??= []).push(cb);
	};
	vi.stubGlobal('window', { addEventListener });
	vi.stubGlobal('document', { addEventListener, visibilityState: 'visible' });
	vi.stubGlobal('console', { ...console, error: vi.fn() });
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

/** Subscribe once, resolve the initial connect, and return the live instance. */
async function subscribeAndSettle(
	mod: Awaited<ReturnType<typeof importModule>>,
	opts: { expectsHeartbeat?: boolean } = {}
): Promise<{ pb: MockPB; cleanup: () => void }> {
	const cleanup = mod.subscribeRealtime({
		collection: 'conversations',
		topic: 'conv1',
		handler: () => {},
		expectsHeartbeat: opts.expectsHeartbeat
	});
	await flush();
	const pb = hoisted.instances[0];
	return { pb, cleanup };
}

describe('realtime watchdog', () => {
	it('reconnects when the SDK reports the socket is down', async () => {
		const mod = await importModule();
		const { pb } = await subscribeAndSettle(mod, { expectsHeartbeat: true });
		pb.realtime.unsubscribe.mockClear();

		pb.realtime.isConnected = false;
		await vi.advanceTimersByTimeAsync(WATCHDOG_INTERVAL_MS);
		await flush();

		expect(pb.realtime.unsubscribe).toHaveBeenCalled();
	});

	it('reconnects on a disconnected socket even without a heartbeat sub', async () => {
		const mod = await importModule();
		const { pb } = await subscribeAndSettle(mod); // no expectsHeartbeat
		pb.realtime.unsubscribe.mockClear();

		pb.realtime.isConnected = false;
		await vi.advanceTimersByTimeAsync(WATCHDOG_INTERVAL_MS);
		await flush();

		expect(pb.realtime.unsubscribe).toHaveBeenCalled();
	});

	it('reconnects on staleness when a heartbeat sub is active', async () => {
		const mod = await importModule();
		const { pb } = await subscribeAndSettle(mod, { expectsHeartbeat: true });
		pb.realtime.unsubscribe.mockClear();
		pb.realtime.isConnected = true;

		// No events for longer than the stale threshold → frozen stream.
		await vi.advanceTimersByTimeAsync(REALTIME_STALE_MS + WATCHDOG_INTERVAL_MS);
		await flush();

		expect(pb.realtime.unsubscribe).toHaveBeenCalled();
	});

	it('does NOT reconnect on staleness without a heartbeat sub', async () => {
		const mod = await importModule();
		const { pb } = await subscribeAndSettle(mod); // no expectsHeartbeat
		pb.realtime.unsubscribe.mockClear();
		pb.realtime.isConnected = true;

		await vi.advanceTimersByTimeAsync(REALTIME_STALE_MS + WATCHDOG_INTERVAL_MS);
		await flush();

		expect(pb.realtime.unsubscribe).not.toHaveBeenCalled();
	});

	it('does NOT reconnect while events keep the connection fresh', async () => {
		const mod = await importModule();
		const { pb } = await subscribeAndSettle(mod, { expectsHeartbeat: true });
		pb.realtime.unsubscribe.mockClear();
		pb.realtime.isConnected = true;

		// Deliver an event just before each stale threshold would elapse.
		for (let elapsed = 0; elapsed < REALTIME_STALE_MS * 2; elapsed += WATCHDOG_INTERVAL_MS) {
			await vi.advanceTimersByTimeAsync(WATCHDOG_INTERVAL_MS);
			pb.handlers[pb.handlers.length - 1]?.({ action: 'update' });
			await flush();
		}

		expect(pb.realtime.unsubscribe).not.toHaveBeenCalled();
	});

	it('does NOT reconnect when there are no active subscriptions', async () => {
		const mod = await importModule();
		const { pb, cleanup } = await subscribeAndSettle(mod, { expectsHeartbeat: true });
		cleanup(); // registry now empty; listeners + interval remain installed
		pb.realtime.isConnected = false;
		pb.realtime.unsubscribe.mockClear();

		await vi.advanceTimersByTimeAsync(REALTIME_STALE_MS + WATCHDOG_INTERVAL_MS);
		await flush();

		expect(pb.realtime.unsubscribe).not.toHaveBeenCalled();
	});

	it('does NOT reconnect while the tab is hidden', async () => {
		const mod = await importModule();
		const { pb } = await subscribeAndSettle(mod, { expectsHeartbeat: true });
		pb.realtime.unsubscribe.mockClear();
		pb.realtime.isConnected = false;
		(globalThis.document as unknown as { visibilityState: string }).visibilityState = 'hidden';

		await vi.advanceTimersByTimeAsync(WATCHDOG_INTERVAL_MS * 2);
		await flush();

		expect(pb.realtime.unsubscribe).not.toHaveBeenCalled();
	});

	it('resets the activity clock after a reconnect so it does not immediately re-fire', async () => {
		const mod = await importModule();
		const { pb } = await subscribeAndSettle(mod, { expectsHeartbeat: true });
		pb.realtime.isConnected = true;
		pb.realtime.unsubscribe.mockClear();

		// First staleness reconnect.
		await vi.advanceTimersByTimeAsync(REALTIME_STALE_MS + WATCHDOG_INTERVAL_MS);
		await flush();
		expect(pb.realtime.unsubscribe).toHaveBeenCalledTimes(1);

		// The reconnect reset the activity clock: another short interval that stays
		// below the stale threshold must not trigger a second reconnect.
		await vi.advanceTimersByTimeAsync(WATCHDOG_INTERVAL_MS);
		await flush();
		expect(pb.realtime.unsubscribe).toHaveBeenCalledTimes(1);
	});
});

describe('realtime recovery listeners', () => {
	it('reconnects on pageshow when restored from bfcache (persisted)', async () => {
		const mod = await importModule();
		const { pb } = await subscribeAndSettle(mod, { expectsHeartbeat: true });
		pb.realtime.unsubscribe.mockClear();

		fire('pageshow', { persisted: true });
		await flush();

		expect(pb.realtime.unsubscribe).toHaveBeenCalled();
	});

	it('does NOT reconnect on a normal (non-persisted) pageshow', async () => {
		const mod = await importModule();
		const { pb } = await subscribeAndSettle(mod, { expectsHeartbeat: true });
		pb.realtime.unsubscribe.mockClear();

		fire('pageshow', { persisted: false });
		await flush();

		expect(pb.realtime.unsubscribe).not.toHaveBeenCalled();
	});

	it('reconnects when the network comes back online', async () => {
		const mod = await importModule();
		const { pb } = await subscribeAndSettle(mod, { expectsHeartbeat: true });
		pb.realtime.unsubscribe.mockClear();

		fire('online');
		await flush();

		expect(pb.realtime.unsubscribe).toHaveBeenCalled();
	});

	it('reconnects on foreground only after the hidden threshold is exceeded', async () => {
		const mod = await importModule();
		const { pb } = await subscribeAndSettle(mod, { expectsHeartbeat: true });
		pb.realtime.unsubscribe.mockClear();
		const doc = globalThis.document as unknown as { visibilityState: string };

		// Brief hide (< threshold): no reconnect on return.
		doc.visibilityState = 'hidden';
		fire('visibilitychange');
		await vi.advanceTimersByTimeAsync(RECONNECT_AFTER_HIDDEN_MS - 500);
		doc.visibilityState = 'visible';
		fire('visibilitychange');
		await flush();
		expect(pb.realtime.unsubscribe).not.toHaveBeenCalled();

		// Long hide (>= threshold): reconnect on return.
		doc.visibilityState = 'hidden';
		fire('visibilitychange');
		await vi.advanceTimersByTimeAsync(RECONNECT_AFTER_HIDDEN_MS + 500);
		doc.visibilityState = 'visible';
		fire('visibilitychange');
		await flush();
		expect(pb.realtime.unsubscribe).toHaveBeenCalled();
	});
});
