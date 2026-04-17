/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// SvelteKit service-worker module (provides build, files, version)
import { build, files, version } from '$service-worker';

// ─── Precaching (optional, keeps the shell fast) ─────────────────────────────

const CACHE = `allerleih-${version}`;
const ASSETS = [...build, ...files];

// In dev mode Vite compiles entry files with versioned import URLs
// (?v=<hash>) that change whenever Vite re-optimises its deps.  If the
// service worker caches those entry files and Vite later regenerates a
// new hash, the cached files reference modules that no longer exist →
// cascading "failed to load module" errors.  Skipping all caching and
// fetch interception in dev avoids this completely while still keeping
// the push-notification handlers active.
const isDev = version === 'dev';

self.addEventListener('install', (event) => {
	if (isDev) {
		// Activate immediately so stale caches from previous sessions are
		// purged as quickly as possible (see activate handler below).
		self.skipWaiting();
		return;
	}
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}
	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	async function setup() {
		const keys = await caches.keys();
		await Promise.all(
			keys.map((key) =>
				// In dev, purge ALL caches — including the current "allerleih-dev"
				// key — so stale Vite/SvelteKit generated files from the previous
				// SW don't survive activation.
				// In production, only remove keys from older deployments.
				isDev || key !== CACHE ? caches.delete(key) : Promise.resolve()
			)
		);
		// In dev, immediately claim all open tabs so this SW (which does
		// nothing in its fetch handler) displaces the old one mid-session —
		// no tab-close/reopen required.
		if (isDev) await self.clients.claim();
	}
	event.waitUntil(setup());
});

self.addEventListener('fetch', (event) => {
	// In dev mode let the browser handle everything natively.
	if (isDev) return;
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Only intercept same-origin requests for explicitly cached assets.
	// Cross-origin requests (PocketBase API/SSE) and anything not in the
	// pre-cached ASSETS list are left to the browser.
	if (url.origin !== self.location.origin) return;
	if (!ASSETS.includes(url.pathname)) return;

	event.respondWith(
		caches.open(CACHE).then(async (cache) => {
			const cached = await cache.match(event.request);
			return cached ?? fetch(event.request);
		})
	);
});

// ─── Push notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
	if (!event.data) return;

	const payload = event.data.json() as { title: string; body: string; url?: string };

	event.waitUntil(
		self.clients
			.matchAll({ type: 'window', includeUncontrolled: true })
			.then((clientList) => {
				// Suppress the push if the user already has the target page open
				if (payload.url) {
					const alreadyViewing = clientList.some((c) => c.url.endsWith(payload.url!));
					if (alreadyViewing) return;
				}

				return self.registration.showNotification(payload.title, {
					body: payload.body,
					icon: '/icon-192x192.png',
					badge: '/icon-192x192.png',
					data: { url: payload.url ?? '/notifications' },
				});
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
