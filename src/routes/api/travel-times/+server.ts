import { json } from '@sveltejs/kit';
import { ORS_API_KEY } from '$env/static/private';

type TransportMode = 'foot' | 'bicycle' | 'car';

const ORS_PROFILE: Record<TransportMode, string> = {
	foot: 'foot-walking',
	bicycle: 'cycling-regular',
	car: 'driving-car',
};

interface OwnerLocation {
	id: string;
	lon: number;
	lat: number;
}

interface RequestBody {
	userLocation: { lon: number; lat: number };
	transportMode: TransportMode;
	owners: OwnerLocation[];
}

export async function POST({ request }) {
	const body: RequestBody = await request.json();
	const { userLocation, transportMode, owners } = body;

	if (!owners || owners.length === 0) {
		return json({});
	}

	const profile = ORS_PROFILE[transportMode] ?? 'cycling-regular';

	// Build locations array: index 0 = current user, indices 1..N = owners
	const locations = [
		[userLocation.lon, userLocation.lat],
		...owners.map((o) => [o.lon, o.lat]),
	];

	const destinations = owners.map((_, i) => i + 1);

	try {
		const orsResponse = await fetch(
			`https://api.openrouteservice.org/v2/matrix/${profile}`,
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
					destinations,
					metrics: ['duration'],
				}),
			}
		);

		if (!orsResponse.ok) {
			console.error('ORS API error:', orsResponse.status, await orsResponse.text());
			return json({});
		}

		const orsData = await orsResponse.json();
		const durations: number[] = orsData.durations?.[0] ?? [];

		// Map owner id → travel minutes
		const result: Record<string, number> = {};
		owners.forEach((owner, i) => {
			const seconds = durations[i];
			if (seconds != null) {
				result[owner.id] = Math.round(seconds / 60);
			}
		});

		return json(result);
	} catch (err) {
		console.error('ORS fetch failed:', err);
		return json({});
	}
}
