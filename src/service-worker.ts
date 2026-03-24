/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// SvelteKit service-worker module (provides build, files, version)
import { build, files, version } from '$service-worker';

// ─── Precaching (optional, keeps the shell fast) ─────────────────────────────

const CACHE = `allerleih-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}
	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}
	event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);
		// Serve build assets directly from cache
		if (ASSETS.includes(url.pathname)) {
			const cachedResponse = await cache.match(event.request);
			if (cachedResponse) return cachedResponse;
		}
		return fetch(event.request);
	}
	event.respondWith(respond());
});

// ─── Push notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
	if (!event.data) return;

	const data = event.data.json() as { title: string; body: string; url?: string };

	event.waitUntil(
		self.registration.showNotification(data.title, {
			body: data.body,
			icon: '/icon-192x192.png',
			badge: '/icon-192x192.png',
			data: { url: data.url ?? '/notifications' },
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	const url: string = (event.notification.data as { url: string }).url;

	event.waitUntil(
		self.clients
			.matchAll({ type: 'window', includeUncontrolled: true })
			.then((clientList) => {
				// Focus an existing window if one is already open
				for (const client of clientList) {
					if (client.url.includes(self.location.origin) && 'focus' in client) {
						client.navigate(url);
						return client.focus();
					}
				}
				// Otherwise open a new window
				return self.clients.openWindow(url);
			})
	);
});
