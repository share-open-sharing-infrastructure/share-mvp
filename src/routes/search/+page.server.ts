import { PB_URL } from '../../hooks.server';
import type { Item } from '$lib/types/models';
import { filterTrustedItems } from '$lib/server/itemFilters';

export async function load({ locals }) {
	// Fetch all items from PocketBase
	const items: Item[] = await locals.pb.collection('items').getFullList({
		expand: 'owner', // expand the relation to the 'owner' (user) collection
		sort: '-updated', // sort by update date descending
		filter: locals.user ? `owner != "${locals.user.id}"` : undefined // exclude user's own items from search results (if logged in)
	});

	// Filter out items which the current user is not trusted with
	const filteredItems = filterTrustedItems(
		items,
		locals.user ? locals.user.id : null,
		locals.pb.authStore.isValid 
	);

	// Extract unique places and names for filtering options
	const uniquePlaces = Array.from(new Set(filteredItems.map((item) => item.place))); // deduplicates places by creating a Set

	// Return data to the page
	return {
		items: filteredItems,
		PB_IMG_URL: PB_URL,
		uniquePlaces: uniquePlaces,
		userId: locals.user ? locals.user.id : null
	};
}