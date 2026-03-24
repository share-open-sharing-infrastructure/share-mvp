import { json } from '@sveltejs/kit';
import { ORS_API_KEY } from '$env/static/private';

export async function GET({ url }) {
	const q = url.searchParams.get('q') ?? '';

	if (q.length < 2) {
		return json({ suggestions: [] });
	}

	try {
		const params = new URLSearchParams({
			api_key: ORS_API_KEY ?? '',
			text: q,
			lang: 'de',
			size: '5',
			'boundary.country': 'DEU',
		});

		const response = await fetch(
			`https://api.openrouteservice.org/geocode/autocomplete?${params}`
		);

		if (!response.ok) {
			console.error('ORS geocode error:', response.status, await response.text());
			return json({ suggestions: [] });
		}

		const data = await response.json();
		const suggestions = (data.features ?? []).map((feature: {
			properties: { label: string };
			geometry: { coordinates: [number, number] };
		}) => ({
			label: feature.properties.label,
			lon: feature.geometry.coordinates[0],
			lat: feature.geometry.coordinates[1],
		}));

		return json({ suggestions });
	} catch (err) {
		console.error('ORS geocode fetch failed:', err);
		return json({ suggestions: [] });
	}
}
