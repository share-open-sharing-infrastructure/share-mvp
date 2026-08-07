/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// SvelteKit service-worker module (provides build, files, version)
import { build, files, version } from '$service-worker';
import { respondWithAsset } from '$lib/serviceWorker/respondWithAsset';

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
const isDev = !build.length;

self.addEventListener('install', (event) => {
	// A new worker normally stays "waiting" until every tab using the old one is
	// closed; skipWaiting() lets this version take over right away.
	self.skipWaiting();
	if (isDev) return;
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		// allSettled, not addAll: one missing asset must not abort installation
		// (a failed install leaves no active worker at all).
		await Promise.allSettled(ASSETS.map((asset) => cache.add(asset)));
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
		// A freshly activated worker otherwise only controls pages opened after
		// it. claim() takes control of already-open windows now, which is what
		// lets notificationclick below call WindowClient.navigate() on them —
		// navigate() rejects on a window the worker does not control.
		await self.clients.claim();
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

	// Cache-first with self-heal; never rejects (see respondWithAsset for why —
	// a rejected respondWith is what crashed the page after onboarding, #291).
	event.respondWith(
		caches.open(CACHE).then((cache) => respondWithAsset(event.request, url.pathname, cache))
	);
});

// ─── Push notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
	if (!event.data) return;

	const notificationPayload = event.data.json() as { title: string; body: string; url?: string };

	const targetPath = notificationPayload.url ?? '/notifications';
	// Resolve to an absolute URL once, exactly as notificationclick below does, so
	// both handlers match open windows by the same rule. A substring check would
	// miss a client carrying a query string or hash, and could match an unrelated
	// route that merely ends with this path.
	const target = new URL(targetPath, self.location.origin).href;

	event.waitUntil(
		self.clients
			.matchAll({ type: 'window', includeUncontrolled: true })
			.then((clientList) => {
				// Suppress the push only when the target page is open AND in front of the
				// user — there the realtime subscription has already updated the UI, so an
				// OS notification is just noise. matchAll() also returns background and
				// minimised windows; suppressing on those would silently drop the
				// notification, and showing nothing at all makes the browser enforce our
				// userVisibleOnly subscription itself (Chrome substitutes a generic "site
				// updated in the background" notification; Firefox eventually drops the
				// subscription).
				const alreadyViewing = clientList.some(
					(client) => client.focused && client.url === target
				);
				if (alreadyViewing) return;

				return self.registration.showNotification(notificationPayload.title, {
					body: notificationPayload.body,
					icon: '/icon-192x192.png',
					badge: '/icon-192x192.png',
					data: { url: targetPath },
				});
			})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	const data = event.notification.data as { url?: string } | null;
	const target = new URL(data?.url ?? '/notifications', self.location.origin).href;

	event.waitUntil(
		(async () => {
			const clientList = await self.clients.matchAll({
				type: 'window',
				includeUncontrolled: true
			});

			// Reuse an already-open app window (especially the installed PWA):
			// navigate it to the notification's target page and focus it. We only
			// fall back to openWindow() when no window is open, because in a PWA
			// openWindow() spawns a separate browser tab instead of the app.
			for (const client of clientList) {
				if (!client.url.startsWith(self.location.origin)) continue;
				if (client.url !== target) {
					try {
						await client.navigate(target);
					} catch {
						/* focus the window even if navigation isn't possible */
					}
				}
				try {
					await client.focus();
				} catch {
					/* ignore */
				}
				return;
			}

			await self.clients.openWindow(target);
		})()
	);
});
