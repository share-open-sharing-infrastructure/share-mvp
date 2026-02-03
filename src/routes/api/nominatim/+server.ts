import { json } from '@sveltejs/kit';

export async function GET({ url, fetch }) {
	const search = url.searchParams.get('q');

	if (!search) {
		return json([]);
	}

	const nominatimUrl =
		`https://nominatim.openstreetmap.org/search?format=json&city=${encodeURIComponent(search)}&limit=10&countrycodes=de`;

	const res = await fetch(nominatimUrl);
	const results = await res.json();

	return json(results);
}
