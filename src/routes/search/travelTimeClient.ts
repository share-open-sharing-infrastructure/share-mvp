import type { ItemPublic } from '$lib/types/models';

/**
 * Framework-free plumbing for the search page's travel-time filter (mirrors how the
 * conversations route splits chatScroll/presenceHeartbeat out of its components):
 * the ORS fetch with its timeout + diagnostics and the fire-and-forget mode
 * persistence. Browser geolocation lives in $lib/utils/geolocation.ts; all UI state
 * stays in TravelTimeFilter.svelte.
 */

export type TransportMode = 'foot' | 'bicycle' | 'car';
export type GeoPoint = { lon: number; lat: number };

/** Fire-and-forget: sends a diagnostic event to the server log. Never throws. */
export function sendDiag(payload: Record<string, unknown>): void {
	fetch('/api/diagnostics', { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});
}

/**
 * Fetches travel times from the user's location to every item owner via
 * /api/travel-times/search. Aborts after 15s so a hanging ORS response doesn't leave
 * the UI stuck indefinitely. Returns the owner-id → minutes map, or null when there
 * was nothing to fetch or the request failed (failures are logged via sendDiag —
 * the filter then simply stays inactive).
 */
export async function fetchTravelTimes(
	mode: TransportMode,
	userLocation: GeoPoint,
	items: ItemPublic[]
): Promise<Record<string, number> | null> {
	const ownerIds = [...new Set(items.map((item) => item.userId).filter(Boolean))];
	if (ownerIds.length === 0) return null;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 15_000);
	try {
		const response = await fetch('/api/travel-times/search', {
			method: 'POST',
			signal: controller.signal,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userLocation, transportMode: mode, ownerIds }),
		});

		if (response.ok) {
			return await response.json();
		}
		sendDiag({ event: 'fetch_error', page: 'search', status: response.status });
		return null;
	} catch (err) {
		// AbortError means our 15s timeout fired; any other error is a network failure
		const isTimeout = err instanceof DOMException && err.name === 'AbortError';
		sendDiag({ event: isTimeout ? 'fetch_timeout' : 'fetch_error', page: 'search' });
		return null;
	} finally {
		clearTimeout(timeoutId);
	}
}

/** Persists the chosen mode to user_preferences via the page's form action.
 *  Fire-and-forget — a failed save only costs the default on the next visit. */
export function persistTransportMode(mode: TransportMode): void {
	const fd = new FormData();
	fd.append('mode', mode);
	fetch('?/saveTransportMode', { method: 'POST', body: fd }).catch((err) =>
		console.error('Failed to save transport mode:', err)
	);
}
