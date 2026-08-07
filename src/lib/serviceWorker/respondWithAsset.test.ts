import { describe, it, expect, vi } from 'vitest';
import { respondWithAsset } from './respondWithAsset';

const PATH = '/_app/immutable/chunks/search.abc123.js';
const req = () => new Request(`https://app.example${PATH}`);

/** Minimal in-memory stand-in for the Cache API. */
function makeCache(initial: Record<string, Response> = {}) {
	const store = new Map<string, Response>(Object.entries(initial));
	return {
		store,
		match: vi.fn(async (key: string) => store.get(key)),
		put: vi.fn(async (key: string, res: Response) => {
			store.set(key, res);
		}),
	};
}

describe('respondWithAsset', () => {
	it('serves the precached asset without touching the network', async () => {
		const cached = new Response('cached-js');
		const cache = makeCache({ [PATH]: cached });
		const fetchFn = vi.fn();

		const res = await respondWithAsset(req(), PATH, cache as unknown as Cache, fetchFn);

		expect(res).toBe(cached);
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('falls back to the network on a cache miss and self-heals the cache', async () => {
		const cache = makeCache();
		const networkRes = new Response('fresh-js', { status: 200 });
		const fetchFn = vi.fn(async () => networkRes);

		const res = await respondWithAsset(req(), PATH, cache as unknown as Cache, fetchFn);

		expect(res).toBe(networkRes);
		expect(cache.put).toHaveBeenCalledWith(PATH, expect.any(Response));
	});

	it('does not cache a non-ok network response', async () => {
		const cache = makeCache();
		const fetchFn = vi.fn(async () => new Response('nope', { status: 404 }));

		await respondWithAsset(req(), PATH, cache as unknown as Cache, fetchFn);

		expect(cache.put).not.toHaveBeenCalled();
	});

	// Regression for #291: a cache miss + failing network fetch must resolve to a
	// Response, never reject. A rejected respondWith is what surfaced Safari's
	// "FetchEvent.respondWith received an error: TypeError: Load failed" and
	// crashed the page after onboarding.
	it('resolves to a network-error Response instead of rejecting when offline', async () => {
		const cache = makeCache();
		const fetchFn = vi.fn(async () => {
			throw new TypeError('Load failed');
		});

		const res = await respondWithAsset(req(), PATH, cache as unknown as Cache, fetchFn);

		expect(res).toBeInstanceOf(Response);
		expect(res.type).toBe('error');
	});

	it('recovers from the cache if a parallel request populated it after the network failed', async () => {
		const cache = makeCache();
		const healed = new Response('healed-js');
		const fetchFn = vi.fn(async () => {
			// simulate another in-flight request warming the cache before we retry
			cache.store.set(PATH, healed);
			throw new TypeError('Load failed');
		});

		const res = await respondWithAsset(req(), PATH, cache as unknown as Cache, fetchFn);

		expect(res).toBe(healed);
	});
});
