import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// pushSubscription.ts reads the VAPID public key from here at import time.
vi.mock('$env/static/public', () => ({ PUBLIC_VAPID_PUBLIC_KEY: 'dGVzdA' }));

import { teardownPushSubscription, nextPushRegistration } from './pushSubscription';

describe('nextPushRegistration', () => {
	it('registers on first login when permission is granted', () => {
		expect(nextPushRegistration('userA', undefined, true)).toEqual({
			register: true,
			lastRegisteredUserId: 'userA',
		});
	});

	it('does not re-register while the same user stays logged in', () => {
		expect(nextPushRegistration('userA', 'userA', true)).toEqual({
			register: false,
			lastRegisteredUserId: 'userA',
		});
	});

	it('registers when a different user logs in on the device', () => {
		expect(nextPushRegistration('userB', 'userA', true)).toEqual({
			register: true,
			lastRegisteredUserId: 'userB',
		});
	});

	it('does not register without granted permission', () => {
		expect(nextPushRegistration('userA', undefined, false)).toEqual({
			register: false,
			lastRegisteredUserId: undefined,
		});
	});

	it('re-arms on logout by clearing the tracked id', () => {
		expect(nextPushRegistration(undefined, 'userA', true)).toEqual({
			register: false,
			lastRegisteredUserId: undefined,
		});
	});

	it('re-registers the SAME user after a logout dip (regression guard for prior finding #1)', () => {
		// logged in as A → registers
		let state = nextPushRegistration('userA', undefined, true);
		expect(state).toEqual({ register: true, lastRegisteredUserId: 'userA' });
		// logout → re-arms (tracked id cleared)
		state = nextPushRegistration(undefined, state.lastRegisteredUserId, true);
		expect(state).toEqual({ register: false, lastRegisteredUserId: undefined });
		// same user logs back in (same tab) → MUST register again
		state = nextPushRegistration('userA', state.lastRegisteredUserId, true);
		expect(state).toEqual({ register: true, lastRegisteredUserId: 'userA' });
	});
});

describe('teardownPushSubscription', () => {
	let unsubscribe: ReturnType<typeof vi.fn>;
	let getSubscription: ReturnType<typeof vi.fn>;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		unsubscribe = vi.fn().mockResolvedValue(true);
		getSubscription = vi.fn();
		fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal('fetch', fetchMock);
		vi.stubGlobal('window', { PushManager: function PushManager() {} });
		vi.stubGlobal('navigator', {
			serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription } }) },
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('unsubscribes the device and DELETEs the subscription by endpoint (with an abort signal)', async () => {
		getSubscription.mockResolvedValue({ endpoint: 'https://push.example/abc', unsubscribe });

		await teardownPushSubscription();

		expect(unsubscribe).toHaveBeenCalledOnce();
		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, opts] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/push-subscribe');
		expect(opts.method).toBe('DELETE');
		expect(JSON.parse(opts.body)).toEqual({ endpoint: 'https://push.example/abc' });
		// timeout guard so a hanging network can't stall the caller (logout)
		expect(opts.signal).toBeInstanceOf(AbortSignal);
	});

	it('no-ops when this device has no subscription', async () => {
		getSubscription.mockResolvedValue(null);

		await teardownPushSubscription();

		expect(unsubscribe).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('never throws when the server DELETE fails (so logout is never blocked)', async () => {
		getSubscription.mockResolvedValue({ endpoint: 'https://push.example/abc', unsubscribe });
		fetchMock.mockRejectedValue(new Error('network down'));

		await expect(teardownPushSubscription()).resolves.toBeUndefined();
		// local unsubscribe still ran before the (failed) network call
		expect(unsubscribe).toHaveBeenCalledOnce();
	});

	it('returns early when push is unsupported (no serviceWorker)', async () => {
		vi.stubGlobal('navigator', {});

		await teardownPushSubscription();

		expect(fetchMock).not.toHaveBeenCalled();
	});
});
