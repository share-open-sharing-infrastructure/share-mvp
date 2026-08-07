import type PocketBase from 'pocketbase';
import type { ClientResponseError } from 'pocketbase';
import { deleteSingletonRow, upsertSingletonRow } from '$lib/server/singletonRow';

export type GeoPoint = { lon: number; lat: number };

/** The user's geolocation row id, or null if none exists yet. */
async function findGeolocationRow(pb: PocketBase, userId: string): Promise<{ id: string } | null> {
	try {
		return await pb
			.collection('user_geolocations')
			.getFirstListItem(pb.filter('user = {:u}', { u: userId }), { fields: 'id' });
	} catch (err) {
		// PocketBase reports "no match" as a 404. Anything else (500, network, expired
		// token) must not be read as "the user has no location": on the clear path that
		// would skip the delete and still report success, leaving the coordinates stored.
		if ((err as Partial<ClientResponseError>)?.status === 404) return null;
		throw err;
	}
}

/** Reads the current user's own stored geolocation, or null if none/null-island. */
export async function getUserGeolocation(pb: PocketBase, userId: string): Promise<GeoPoint | null> {
	try {
		const rec = await pb
			.collection('user_geolocations')
			.getFirstListItem(pb.filter('user = {:u}', { u: userId }));
		const geo = rec.geolocation as GeoPoint | undefined;
		return geo && !(geo.lon === 0 && geo.lat === 0) ? geo : null;
	} catch {
		// Read path, so the blanket catch is deliberate here (unlike findGeolocationRow
		// above): nothing writes based on this value — a failed read just renders the form
		// as "no location", and the clear is driven by the emptied city field, not by this.
		return null;
	}
}

/** Upserts (or clears, when geo is null) the user's own geolocation entry. */
export async function upsertUserGeolocation(
	pb: PocketBase,
	userId: string,
	geo: GeoPoint | null
): Promise<void> {
	const find = () => findGeolocationRow(pb, userId);

	if (!geo) {
		await deleteSingletonRow({ pb, collection: 'user_geolocations', find });
		return;
	}
	await upsertSingletonRow({
		pb,
		collection: 'user_geolocations',
		find,
		createData: { user: userId, geolocation: geo },
		patch: { geolocation: geo },
	});
}
