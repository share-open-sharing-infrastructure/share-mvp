import { vapidPublicKey } from '$lib/publicEnv';

/** Convert a base64url VAPID public key to a Uint8Array for the Web Push API. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	const output = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; i++) {
		output[i] = rawData.charCodeAt(i);
	}
	return output;
}

/**
 * Pure decision for the layout's push re-registration effect: given the current
 * logged-in user id, the id this device last registered a subscription for, and
 * whether notification permission is granted, returns whether to (re-)register
 * now and the id to remember next.
 *
 * Resetting to `undefined` on logout (no current user) re-arms registration for
 * the next login — including a re-login by the SAME user, whose subscription was
 * torn down on logout. Without this reset a same-tab same-user logout→login is
 * left with no push subscription.
 */
export function nextPushRegistration(
	currentUserId: string | undefined,
	lastRegisteredUserId: string | undefined,
	permissionGranted: boolean
): { register: boolean; lastRegisteredUserId: string | undefined } {
	if (!currentUserId) return { register: false, lastRegisteredUserId: undefined };
	if (currentUserId !== lastRegisteredUserId && permissionGranted) {
		return { register: true, lastRegisteredUserId: currentUserId };
	}
	return { register: false, lastRegisteredUserId };
}

/** `serviceWorker.ready` can hang indefinitely if the SW never activates, so every
 *  caller races it against a 10 s failsafe to avoid a silent hang. */
function swReady(): Promise<ServiceWorkerRegistration> {
	const timeout = new Promise<never>((_, reject) =>
		setTimeout(() => reject(new Error('serviceWorker.ready timeout')), 10000)
	);
	return Promise.race([navigator.serviceWorker.ready, timeout]);
}

/** DELETE against /api/push-subscribe, bounded to 4 s. Callers (e.g. logout, the
 *  notification-settings toggles) await the teardown, and a slow or hanging
 *  connection must not stall them. The local unsubscribe has already detached this
 *  device before this runs, so aborting doesn't weaken the guarantee — the server
 *  record is also cleaned up lazily on the next push (410 Gone) if the request
 *  never lands. */
async function boundedUnsubscribeRequest(body: Record<string, unknown>): Promise<void> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 4000);
	try {
		await fetch('/api/push-subscribe', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeout);
	}
}

/** Sets up the Web Push subscription and registers it with the server.
 *  Called either silently (permission already granted) or after the user
 *  taps "Aktivieren" (satisfying the user-gesture requirement). */
export async function setupPushSubscription(): Promise<void> {
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
	try {
		const registration = await swReady();
		const existing = await registration.pushManager.getSubscription();
		const subscription =
			existing ??
			(await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(vapidPublicKey()),
			}));

		const { endpoint, keys } = subscription.toJSON() as {
			endpoint: string;
			keys: { p256dh: string; auth: string };
		};

		await fetch('/api/push-subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ endpoint, keys }),
		});
	} catch (err) {
		console.error('Push subscription failed:', err);
	}
}

/** Unsubscribes this device from the browser's push manager and removes ALL
 *  push subscription records for the user from the server (every device).
 *  Safe to call even when no subscription exists on this device. */
export async function teardownAllPushSubscriptions(): Promise<void> {
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
	try {
		const registration = await swReady();
		const subscription = await registration.pushManager.getSubscription();
		if (subscription) {
			await subscription.unsubscribe();
		}
		await boundedUnsubscribeRequest({ all: true });
	} catch (err) {
		console.error('Push unsubscription (all devices) failed:', err);
	}
}

/** Unsubscribes from the browser's push manager and removes the record from
 *  the server. Safe to call even when no subscription exists. */
export async function teardownPushSubscription(): Promise<void> {
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
	try {
		const registration = await swReady();
		const subscription = await registration.pushManager.getSubscription();
		if (!subscription) return;

		await subscription.unsubscribe();
		await boundedUnsubscribeRequest({ endpoint: subscription.endpoint });
	} catch (err) {
		console.error('Push unsubscription failed:', err);
	}
}
