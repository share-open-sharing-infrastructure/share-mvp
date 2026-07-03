import type PocketBase from 'pocketbase';

export type TransportMode = 'foot' | 'bicycle' | 'car';

// ---------------------------------------------------------------------------
// Server-side cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

type CacheEntry = { result: Record<string, number>; expiresAt: number };
const travelTimesCache = new Map<string, CacheEntry>();

function buildCacheKey(
	userLocation: { lon: number; lat: number },
	transportMode: TransportMode,
	ownerIds: string[]
): string {
	const lat = userLocation.lat.toFixed(3);
	const lon = userLocation.lon.toFixed(3);
	return `${lat}:${lon}:${transportMode}:${[...ownerIds].sort().join(',')}`;
}

function getCached(key: string): Record<string, number> | null {
	const entry = travelTimesCache.get(key);
	if (!entry) return null;
	if (Date.now() > entry.expiresAt) {
		travelTimesCache.delete(key);
		return null;
	}
	return entry.result;
}

function setCached(key: string, result: Record<string, number>) {
	travelTimesCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------

/**
 * Returns a map of owner ID → bucketed travel minutes from `userLocation`.
 * Coordinate lookup + ORS call happen in the backend `/api/travel-times` hook
 * so owner coordinates never reach this server or the client. Cached 10 min.
 */
export async function getTravelTimesForOwners(
	pb: PocketBase,
	userLocation: { lon: number; lat: number },
	transportMode: TransportMode,
	ownerIds: string[]
): Promise<Record<string, number>> {
	if (ownerIds.length === 0) return {};

	const cacheKey = buildCacheKey(userLocation, transportMode, ownerIds);
	const cached = getCached(cacheKey);
	if (cached) return cached;

	try {
		const result = await pb.send<Record<string, number>>('/api/travel-times', {
			method: 'POST',
			body: { transportMode, userLocation, ownerIds },
		});
		const safe = result ?? {};
		setCached(cacheKey, safe);
		return safe;
	} catch (err) {
		console.error('Travel-times hook failed:', err);
		return {};
	}
}
