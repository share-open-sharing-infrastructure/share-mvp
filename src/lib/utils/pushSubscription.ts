import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';

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

/** Sets up the Web Push subscription and registers it with the server.
 *  Called either silently (permission already granted) or after the user
 *  taps "Aktivieren" (satisfying the user-gesture requirement). */
export async function setupPushSubscription(): Promise<void> {
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
	try {
		const registration = await navigator.serviceWorker.ready;
		const existing = await registration.pushManager.getSubscription();
		const subscription =
			existing ??
			(await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_PUBLIC_KEY),
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
