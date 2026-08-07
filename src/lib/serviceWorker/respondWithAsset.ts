/**
 * Cache-first response strategy for precached build assets. Extracted from the
 * service worker so the failure mode behind issue #291 can be unit-tested
 * without a ServiceWorkerGlobalScope.
 *
 * Hardening over a plain `cached ?? fetch(request)`:
 *  - matches by pathname, so a stray `?v=…` query string can't miss an
 *    otherwise-cached immutable asset;
 *  - self-heals the cache on a successful network fetch, so an asset that a
 *    partial install (`Promise.allSettled`) or a mid-session skipWaiting/claim
 *    takeover left uncached gets stored on first use;
 *  - never rejects: a failed network fetch resolves to `Response.error()`
 *    instead. A rejected `respondWith` is what surfaced Safari's
 *    "FetchEvent.respondWith received an error: TypeError: Load failed" and
 *    crashed the page after onboarding — returning a Response lets SvelteKit's
 *    own navigation error handling take over instead.
 */
export async function respondWithAsset(
	request: Request,
	pathname: string,
	cache: Cache,
	fetchFn: typeof fetch = fetch
): Promise<Response> {
	const cached = await cache.match(pathname);
	if (cached) return cached;

	try {
		const response = await fetchFn(request);
		// Best-effort self-heal; caching must never discard a good response, so
		// fire-and-forget and swallow put failures (e.g. quota, opaque response).
		if (response.ok) void cache.put(pathname, response.clone()).catch(() => {});
		return response;
	} catch {
		// Network failed (flaky mobile connection). A parallel request may have
		// warmed the cache in the meantime — retry once — otherwise fail
		// gracefully with a network-error Response rather than rejecting.
		const retry = await cache.match(pathname);
		return retry ?? Response.error();
	}
}
