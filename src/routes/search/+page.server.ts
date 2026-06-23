import { PUBLIC_PB_URL } from '../../hooks.server';
import type { ItemPublic } from '$lib/types/models';
import { parseSearchParameters, buildItemFilter, type SearchParameters } from './searchFilter';
import type { ListResult } from 'pocketbase';

export async function load({ locals, url }) {
	// 1. Parse search parameters from URL
	const searchParameters = parseSearchParameters(url) as SearchParameters;
	// If user hasn't queried anything, shows only a few random items
	const isRandomResultSet = (!searchParameters.query && searchParameters.selectedCategories.length === 0) ? true : false;

	// 2. Build PocketBase filter
	const filter = buildItemFilter(searchParameters, locals.user?.id);

	// 3. Fetch items — random sample when no query, paginated results otherwise
	const fetchPage = isRandomResultSet ? 1 : searchParameters.page;
	const fetchPerPage = isRandomResultSet ? 8 : searchParameters.perPage;
	const fetchSort = isRandomResultSet ? '@random' : '-updated';

	let result: ListResult<ItemPublic> = { page: 1, perPage: fetchPerPage, totalItems: 0, totalPages: 0, items: [] };
	try {
		result = await locals.pb.collection('items_searchable').getList<ItemPublic>(fetchPage, fetchPerPage, {
			sort: fetchSort,
			filter,
		});
	} catch (error) {
		console.error('Error fetching items:', error);
	}

	// 4. Log search queries (fire-and-forget)
	if (!isRandomResultSet) {
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
		op: searchParameters.op,
		onlyAvailable: searchParameters.onlyAvailable,
		ownerType: searchParameters.ownerType,
		currentUser: locals.user ?? null,
		page: isRandomResultSet ? 1 : result.page,
		perPage: result.perPage,
		totalItems: result.totalItems,
		totalPages: isRandomResultSet ? 0 : result.totalPages,
		isRandom: isRandomResultSet,
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
