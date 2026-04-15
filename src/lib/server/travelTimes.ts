import { ORS_API_KEY } from '$env/static/private';
import type { Item, OwnerLocation } from '$lib/types/models';

export type TransportMode = 'foot' | 'bicycle' | 'car';

const ORS_PROFILE: Record<TransportMode, string> = {
	foot: 'foot-walking',
	bicycle: 'cycling-regular',
	car: 'driving-car',
};

function isNullIsland(geo: { lon: number; lat: number } | undefined | null) {
	return !geo || (geo.lon === 0 && geo.lat === 0);
}

/** Extracts unique owner locations from a list of items, skipping owners with no valid geolocation. */
export function extractOwnerLocations(items: Item[]): OwnerLocation[] {
	const seen = new Map<string, OwnerLocation>();
	for (const item of items) {
		const owner = item.expand?.owner;
		if (!owner?.id || seen.has(owner.id)) continue;
		const geo = owner.geolocation as { lon: number; lat: number } | undefined;
		if (!isNullIsland(geo)) {
			seen.set(owner.id, { id: owner.id, lon: geo!.lon, lat: geo!.lat });
		}
	}
	return Array.from(seen.values());
}

/** Calls the ORS matrix API and returns raw travel durations in seconds, one per owner. 
 * We have 500 requests per day on our free plan, use them wisely!
*/
async function fetchDurationsFromOrs(
	userLocation: { lon: number; lat: number },
	transportMode: TransportMode,
	owners: OwnerLocation[]
): Promise<number[]> {
	const locations = [
		[userLocation.lon, userLocation.lat],
		...owners.map((o) => [o.lon, o.lat]),
	];

	const response = await fetch(
		`https://api.openrouteservice.org/v2/matrix/${ORS_PROFILE[transportMode]}`,
		{
			method: 'POST',
			headers: {
				Accept: 'application/json',
				Authorization: ORS_API_KEY ?? '',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				locations,
				sources: [0],
				destinations: owners.map((_, i) => i + 1),
				metrics: ['duration'],
			}),
		}
	);

	if (!response.ok) {
		console.error('ORS API error:', response.status, await response.text());
		return [];
	}

	const data = await response.json();
	return data.durations?.[0] ?? [];
}

/** Maps raw ORS durations (seconds) to an owner ID → travel minutes record. */
function mapDurationsToOwners(owners: OwnerLocation[], durations: number[]): Record<string, number> {
	const result: Record<string, number> = {};
	owners.forEach((owner, i) => {
		const seconds = durations[i];
		if (seconds != null) result[owner.id] = Math.round(seconds / 60);
	});
	return result;
}

// ---------------------------------------------------------------------------
// Server-side cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

type CacheEntry = { result: Record<string, number>; expiresAt: number };
const travelTimesCache = new Map<string, CacheEntry>();

/**
 * Builds a stable cache key from the user location (rounded to ~110 m),
 * transport mode, and the sorted set of owner IDs.
 */
function buildCacheKey(
	userLocation: { lon: number; lat: number },
	transportMode: TransportMode,
	owners: OwnerLocation[]
): string {
	const lat = userLocation.lat.toFixed(3);
	const lon = userLocation.lon.toFixed(3);
	const ownerIds = owners.map((o) => o.id).sort().join(',');
	return `${lat}:${lon}:${transportMode}:${ownerIds}`;
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
 * Returns a map of owner ID → travel minutes from `userLocation` to the given owners.
 * Results are cached server-side for 10 minutes per (location, mode, owner set).
 */
export async function getTravelTimesForOwners(
	userLocation: { lon: number; lat: number },
	transportMode: TransportMode,
	owners: OwnerLocation[]
): Promise<Record<string, number>> {
	if (owners.length === 0) return {};

	const cacheKey = buildCacheKey(userLocation, transportMode, owners);
	const cached = getCached(cacheKey);
	if (cached) return cached;

	try {
		const durations = await fetchDurationsFromOrs(userLocation, transportMode, owners);
		const result = mapDurationsToOwners(owners, durations);
		setCached(cacheKey, result);
		return result;
	} catch (err) {
		console.error('ORS fetch failed:', err);
		return {};
	}
}
