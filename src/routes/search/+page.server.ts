import { PUBLIC_PB_URL } from '../../hooks.server';
import type { ItemPublic } from '$lib/types/models';
import { parseSearchParameters, buildItemFilter, type SearchParameters } from './searchFilter';
import type { ListResult } from 'pocketbase';

export async function load({ locals, url }) {
	// 1. Parse search parameters from URL
	const searchParameters = parseSearchParameters(url) as SearchParameters;
	const hasQuery = !!searchParameters.query || searchParameters.selectedCategories.length > 0;

	// 2. Build PocketBase filter
	const filter = buildItemFilter(searchParameters, locals.user?.id);

	// 3. Fetch paginated items, newest listings first (by creation date, so edits don't
	//    resurface old items). Empty-query browsing shows the same newest-first catalogue.
	let result: ListResult<ItemPublic> = { page: 1, perPage: searchParameters.perPage, totalItems: 0, totalPages: 0, items: [] };
	try {
		result = await locals.pb.collection('items_searchable').getList<ItemPublic>(searchParameters.page, searchParameters.perPage, {
			sort: '-created',
			filter,
			// Explicit allowlist: the view carries an `items.groups` column purely so
			// its row-level rule can traverse group membership; it must NOT be returned
			// to clients (it would disclose to a viewing member the IDs of other groups
			// an item is shared with). PocketBase can't hide a single view column, so we
			// exclude it at the query layer.
			fields:
				'id,name,image,externalImgUrl,externalUrl,description,trusteesOnly,status,collectionId,categories,updated,userId,username,isInstitution,bio,verified,profileImage,userCreated,ownerHasLocation',
		});
	} catch (error) {
		console.error('Error fetching items:', error);
	}

	// 4. Log search queries (fire-and-forget) — skip blank default browsing
	if (hasQuery) {
		void locals.pb.collection('searches').create({
			query: searchParameters.query,
			categories: searchParameters.selectedCategories.join(','),
		});
	}

	return {
		items: result.items,
		PB_IMG_URL: PUBLIC_PB_URL,
		q: searchParameters.query,
		selectedCategories: searchParameters.selectedCategories,
		onlyAvailable: searchParameters.onlyAvailable,
		ownerType: searchParameters.ownerType,
		currentUser: locals.user ?? null,
		page: result.page,
		perPage: result.perPage,
		totalItems: result.totalItems,
		totalPages: result.totalPages,
	};
}

export const actions = {
	saveTransportMode: async ({ locals, request }) => {
		if (!locals.user) return;
		const formData = await request.formData();
		const mode = formData.get('mode')?.toString();
		if (mode === 'foot' || mode === 'bicycle' || mode === 'car') {
			locals.pb
				.collection('users')
				.update(locals.user.id, { preferredTransportMode: mode });
		}
	},
};
