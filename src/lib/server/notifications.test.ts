import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeMockPb } from '$lib/test-utils/pocketbase';

// The regression guard for issue #627: notifications.ts used to call
// `webpush.setVapidDetails()` at module scope, which throws on an empty subject/key — so
// `vite build`'s analyse pass (which imports every server node with an empty
// `$env/dynamic/private`) could not build an env-less artefact. The VAPID setup is now lazy
// and memoized inside `sendPushToUser`; these tests pin both halves of that.
const { setVapidDetails, sendNotification } = vi.hoisted(() => ({
	setVapidDetails: vi.fn(),
	sendNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('web-push', () => ({ default: { setVapidDetails, sendNotification } }));

const SUBSCRIPTION = {
	id: 's1',
	endpoint: 'https://push.example/x',
	p256dh: 'p',
	auth: 'a',
};

function makePb() {
	const getFullList = vi.fn().mockResolvedValue([SUBSCRIPTION]);
	const deleteRecord = vi.fn().mockResolvedValue(undefined);
	const pb = makeMockPb({
		push_subscriptions: { getFullList, delete: deleteRecord },
	});
	return { pb, getFullList, deleteRecord };
}

/**
 * Loads a fresh copy of notifications.ts under the given env. A fresh module is required per
 * case because the "configured" and "warned once" flags are module state.
 */
async function loadNotifications(env: {
	VAPID_SUBJECT?: string;
	VAPID_PRIVATE_KEY?: string;
	PUBLIC_VAPID_PUBLIC_KEY?: string;
}) {
	vi.resetModules();
	vi.doMock('$env/dynamic/private', () => ({
		env: {
			VAPID_SUBJECT: env.VAPID_SUBJECT,
			VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY,
		},
	}));
	vi.doMock('$env/dynamic/public', () => ({
		env: { PUBLIC_VAPID_PUBLIC_KEY: env.PUBLIC_VAPID_PUBLIC_KEY },
	}));
	return import('./notifications');
}

const FULL_VAPID = {
	VAPID_SUBJECT: 'mailto:ci@example.com',
	VAPID_PRIVATE_KEY: 'Fz1mNiBa1Nk3mpy8KjzIjqKf8R0ff9ZHqw525Vy_d-4',
	PUBLIC_VAPID_PUBLIC_KEY: 'BOFZzlLgQ1kjzoCIyyPuVu',
};

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	vi.clearAllMocks();
	consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	consoleError.mockRestore();
	// `setVapidDetails` has no default implementation, so a test that makes it throw must not
	// leak that into the next one (`clearAllMocks` clears calls, not implementations).
	setVapidDetails.mockReset();
	vi.doUnmock('$env/dynamic/private');
	vi.doUnmock('$env/dynamic/public');
	vi.resetModules();
});

describe('sendPushToUser — VAPID not configured', () => {
	it('returns before touching push_subscriptions and never calls web-push', async () => {
		const { sendPushToUser } = await loadNotifications({});
		const { pb } = makePb();

		await sendPushToUser(pb, 'u1', 'Titel', 'Body', '/conversations/c1');

		expect(pb.collection).not.toHaveBeenCalled();
		expect(setVapidDetails).not.toHaveBeenCalled();
		expect(sendNotification).not.toHaveBeenCalled();
	});

	it('logs the misconfiguration exactly once, not per call', async () => {
		const { sendPushToUser } = await loadNotifications({});
		const { pb } = makePb();

		await sendPushToUser(pb, 'u1', 'Titel', 'Body', '/conversations/c1');
		await sendPushToUser(pb, 'u2', 'Titel', 'Body', '/conversations/c2');

		expect(consoleError).toHaveBeenCalledTimes(1);
		expect(String(consoleError.mock.calls[0][0])).toContain(
			'Web Push disabled'
		);
	});

	it('also bails out when only the public half is missing', async () => {
		const { sendPushToUser } = await loadNotifications({
			VAPID_SUBJECT: FULL_VAPID.VAPID_SUBJECT,
			VAPID_PRIVATE_KEY: FULL_VAPID.VAPID_PRIVATE_KEY,
		});
		const { pb } = makePb();

		await sendPushToUser(pb, 'u1', 'Titel', 'Body', '/conversations/c1');

		expect(pb.collection).not.toHaveBeenCalled();
		expect(setVapidDetails).not.toHaveBeenCalled();
	});
});

// A non-empty but malformed value (VAPID_SUBJECT without a mailto:/https: scheme, a key of the
// wrong decoded length) passes `assertRequiredEnv()`, which only checks non-emptiness — so
// `web-push` is the first thing to reject it. Before #627 the same typo crashed the process at
// boot; now it must degrade to "no push" instead of 500-ing a completed registration.
// Its own block: unlike the "not configured" cases above, this one *requires* `setVapidDetails`
// to be called (and to throw), so that block's shared premise does not hold here.
describe('sendPushToUser — VAPID rejected by web-push', () => {
	it('degrades instead of throwing when web-push rejects the VAPID config', async () => {
		setVapidDetails.mockImplementation(() => {
			throw new Error('Vapid subject is not a url or mailto url');
		});
		const { sendPushToUser } = await loadNotifications({
			...FULL_VAPID,
			VAPID_SUBJECT: 'ci@example.com',
		});
		const { pb } = makePb();

		await expect(
			sendPushToUser(pb, 'u1', 'Titel', 'Body', '/conversations/c1')
		).resolves.toBeUndefined();
		await sendPushToUser(pb, 'u2', 'Titel', 'Body', '/conversations/c2');

		expect(pb.collection).not.toHaveBeenCalled();
		expect(sendNotification).not.toHaveBeenCalled();
		expect(consoleError).toHaveBeenCalledTimes(1);
	});
});

describe('sendPushToUser — VAPID configured', () => {
	it('configures web-push once across two calls and sends a notification per subscription', async () => {
		const { sendPushToUser } = await loadNotifications(FULL_VAPID);
		const { pb, getFullList } = makePb();

		await sendPushToUser(pb, 'u1', 'Titel', 'Body', '/conversations/c1');
		await sendPushToUser(pb, 'u1', 'Titel', 'Body', '/conversations/c1');

		// Memoized: the details land in web-push's module state on the first call only.
		expect(setVapidDetails).toHaveBeenCalledTimes(1);
		expect(setVapidDetails).toHaveBeenCalledWith(
			FULL_VAPID.VAPID_SUBJECT,
			FULL_VAPID.PUBLIC_VAPID_PUBLIC_KEY,
			FULL_VAPID.VAPID_PRIVATE_KEY
		);
		expect(getFullList).toHaveBeenCalledTimes(2);
		expect(sendNotification).toHaveBeenCalledTimes(2);
		expect(sendNotification).toHaveBeenLastCalledWith(
			{ endpoint: SUBSCRIPTION.endpoint, keys: { p256dh: 'p', auth: 'a' } },
			JSON.stringify({ title: 'Titel', body: 'Body', url: '/conversations/c1' })
		);
		expect(consoleError).not.toHaveBeenCalled();
	});

	it('drops a subscription the push service reports as gone (410)', async () => {
		const { sendPushToUser } = await loadNotifications(FULL_VAPID);
		const { pb, deleteRecord } = makePb();
		sendNotification.mockRejectedValueOnce({ statusCode: 410 });

		await sendPushToUser(pb, 'u1', 'Titel', 'Body', '/conversations/c1');

		expect(deleteRecord).toHaveBeenCalledWith(SUBSCRIPTION.id);
		expect(consoleError).not.toHaveBeenCalled();
	});
});
