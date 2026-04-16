import { json, error } from '@sveltejs/kit';
import { getTravelTimesForOwners, type TransportMode } from '$lib/server/travelTimes';
import type { OwnerLocation } from '$lib/types/models';


const VALID_MODES = new Set<string>(['foot', 'bicycle', 'car']);
const MAX_OWNERS = 50;

function isValidCoord(lat: unknown, lon: unknown): boolean {
	return (
		typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90 &&
		typeof lon === 'number' && isFinite(lon) && lon >= -180 && lon <= 180
	);
}

export async function POST({ request }) {
	const body = await request.json();
	const { userLocation, transportMode, owners } = body;

	if (!VALID_MODES.has(transportMode)) {
		error(400, 'Invalid transport mode');
	}
	if (!isValidCoord(userLocation?.lat, userLocation?.lon)) {
		error(400, 'Invalid user location');
	}
	if (!Array.isArray(owners) || owners.length === 0) {
		return json({});
	}
	if (owners.length > MAX_OWNERS) {
		error(400, 'Too many owners');
	}
	if (owners.some((o: OwnerLocation) => !isValidCoord(o?.lat, o?.lon))) {
		error(400, 'Invalid owner location');
	}

	const result = await getTravelTimesForOwners(
		userLocation as { lon: number; lat: number },
		transportMode as TransportMode,
		owners as OwnerLocation[]
	);
	return json(result);
}
