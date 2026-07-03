import { json, error } from '@sveltejs/kit';
import { getTravelTimesForOwners, type TransportMode } from '$lib/server/travelTimes';

const VALID_MODES = new Set<string>(['foot', 'bicycle', 'car']);
const MAX_OWNERS = 50;
const PB_ID_RE = /^[a-z0-9]{15}$/i;

function isValidCoord(lat: unknown, lon: unknown): boolean {
	return (
		typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90 &&
		typeof lon === 'number' && isFinite(lon) && lon >= -180 && lon <= 180
	);
}

/**
 * POST /api/travel-times/search
 * Body: { userLocation: { lat: number, lon: number }, transportMode: TransportMode, ownerIds: string[] }
 * Returns: Record<ownerId, bucketedMinutes>
 *
 * Fetches owner geolocations server-side so coordinates are never sent to the client.
 */
export async function POST({ request, locals }) {
	if (!locals.pb.authStore.isValid) error(401, 'Unauthorized');

	const body = await request.json();
	const { userLocation, transportMode, ownerIds } = body;

	if (!VALID_MODES.has(transportMode)) error(400, 'Invalid transport mode');
	if (!isValidCoord(userLocation?.lat, userLocation?.lon)) error(400, 'Invalid user location');
	if (!Array.isArray(ownerIds) || ownerIds.length === 0) return json({});
	if (ownerIds.length > MAX_OWNERS) error(400, 'Too many owners');
	if (ownerIds.some((id: unknown) => typeof id !== 'string' || !PB_ID_RE.test(id))) error(400, 'Invalid owner ID format');

	const result = await getTravelTimesForOwners(
		locals.pb,
		userLocation as { lon: number; lat: number },
		transportMode as TransportMode,
		ownerIds as string[]
	);

	return json(result);
}
