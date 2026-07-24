import type PocketBase from 'pocketbase';
import { upsertSingletonRow } from '$lib/server/singletonRow';

export type GeoPoint = { lon: number; lat: number };

/** The user's geolocation row id, or null if none exists yet. */
async function findGeolocationRow(pb: PocketBase, userId: string): Promise<{ id: string } | null> {
	try {
		return await pb
			.collection('user_geolocations')
			.getFirstListItem(pb.filter('user = {:u}', { u: userId }), { fields: 'id' });
	} catch {
		return null;
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
		return null;
	}
}

/** Upserts (or clears, when geo is null) the user's own geolocation entry. */
export async function upsertUserGeolocation(
	pb: PocketBase,
	userId: string,
	geo: GeoPoint | null
): Promise<void> {
	if (!geo) {
		const existing = await findGeolocationRow(pb, userId);
		if (existing) await pb.collection('user_geolocations').delete(existing.id);
		return;
	}
	await upsertSingletonRow({
		pb,
		collection: 'user_geolocations',
		find: () => findGeolocationRow(pb, userId),
		createData: { user: userId, geolocation: geo },
		patch: { geolocation: geo },
	});
}
