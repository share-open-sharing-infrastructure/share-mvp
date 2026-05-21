import { json, error } from '@sveltejs/kit';
import { getTravelTimesForOwners, type TransportMode } from '$lib/server/travelTimes';
import type { ClientResponseError } from 'pocketbase';

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

	const idFilter = ownerIds.map((id: string) => `id = "${id}"`).join(' || ');

	let users: { id: string; geolocation?: { lon: number; lat: number } }[] = [];
	try {
		users = await locals.pb.collection('users').getFullList({ filter: idFilter, fields: 'id,geolocation' });
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		error(e.status === 403 ? 403 : 500, 'Failed to fetch owner locations');
	}

	const ownersWithGeo = users
		.filter((u) => u.geolocation && !(u.geolocation.lon === 0 && u.geolocation.lat === 0))
		.map((u) => ({ id: u.id, lon: u.geolocation!.lon, lat: u.geolocation!.lat }));

	if (ownersWithGeo.length === 0) return json({});

	const result = await getTravelTimesForOwners(
		userLocation as { lon: number; lat: number },
		transportMode as TransportMode,
		ownersWithGeo
	);

	return json(result);
}
