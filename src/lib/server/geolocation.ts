import type PocketBase from 'pocketbase';

export type GeoPoint = { lon: number; lat: number };

/** Reads the current user's own stored geolocation, or null if none/null-island. */
export async function getUserGeolocation(pb: PocketBase, userId: string): Promise<GeoPoint | null> {
	try {
		const rec = await pb
			.collection('user_geolocations')
			.getFirstListItem(pb.filter('user = {:u}', { u: userId }));
		const geo = rec.geolocation as GeoPoint | undefined;
		return geo && !(geo.lon === 0 && geo.lat === 0) ? geo : null;
	} catch {
		return null;
	}
}

/** Upserts (or clears, when geo is null) the user's own geolocation entry. */
export async function upsertUserGeolocation(
	pb: PocketBase,
	userId: string,
	geo: GeoPoint | null
): Promise<void> {
	let existingId: string | null = null;
	try {
		const rec = await pb
			.collection('user_geolocations')
			.getFirstListItem(pb.filter('user = {:u}', { u: userId }));
		existingId = rec.id;
	} catch {
		// no existing entry
	}

	if (geo) {
		if (existingId) await pb.collection('user_geolocations').update(existingId, { geolocation: geo });
		else await pb.collection('user_geolocations').create({ user: userId, geolocation: geo });
	} else if (existingId) {
		await pb.collection('user_geolocations').delete(existingId);
	}
}
