import { json, error } from '@sveltejs/kit';
import { getTravelTimesForOwners, type TransportMode } from '$lib/server/travelTimes';
import type { ClientResponseError } from 'pocketbase';

const VALID_MODES = new Set<string>(['foot', 'bicycle', 'car']);

function isValidCoord(lat: unknown, lon: unknown): boolean {
	return (
		typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90 &&
		typeof lon === 'number' && isFinite(lon) && lon >= -180 && lon <= 180
	);
}

/**
 * POST /api/travel-times/item
 * Body: { itemId: string, userLocation: { lat: number, lon: number }, transportMode: TransportMode }
 * Returns: { minutes: number | null }
 *
 * Looks up the item owner's geolocation server-side so coordinates are never sent to the client.
 */
export async function POST({ request, locals }) {
	if (!locals.pb.authStore.isValid) {
		error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { itemId, userLocation, transportMode } = body;

	if (!itemId || typeof itemId !== 'string') {
		error(400, 'Missing itemId');
	}
	if (!VALID_MODES.has(transportMode)) {
		error(400, 'Invalid transport mode');
	}
	if (!isValidCoord(userLocation?.lat, userLocation?.lon)) {
		error(400, 'Invalid user location');
	}

	let ownerGeo: { lon: number; lat: number } | null = null;
	let ownerId: string | null = null;

	try {
		const item = await locals.pb.collection('items').getOne(itemId, { expand: 'owner' });
		ownerId = item.expand?.owner?.id ?? null;
		const geo = item.expand?.owner?.geolocation as { lon: number; lat: number } | undefined;
		if (geo && !(geo.lon === 0 && geo.lat === 0)) {
			ownerGeo = geo;
		}
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		error(e.status === 404 ? 404 : 500, 'Item not found');
	}

	if (!ownerGeo || !ownerId) {
		return json({ minutes: null });
	}

	const result = await getTravelTimesForOwners(
		userLocation as { lon: number; lat: number },
		transportMode as TransportMode,
		[{ id: ownerId, lon: ownerGeo.lon, lat: ownerGeo.lat }]
	);

	return json({ minutes: result[ownerId] ?? null });
}
