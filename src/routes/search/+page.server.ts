import { pbUrl } from '$lib/publicEnv';
import type { ItemPublic } from '$lib/types/models';
import { parseSearchParameters, buildItemFilter, sortToPbSort, type SearchParameters } from './searchFilter';
import type { ListResult } from 'pocketbase';
import { upsertUserPreferences } from '$lib/server/userPreferences';
import { getAttachableGroups } from '$lib/server/groups';

export async function load({ locals, url }) {
	// 1. Parse search parameters from URL
	const searchParameters = parseSearchParameters(url) as SearchParameters;
	const hasQuery = !!searchParameters.query || searchParameters.selectedCategories.length > 0;

	// 2. Load the user's own groups (the dropdown needs them anyway) and enforce the group
	//    filter's authorization here — this, not the UI, is the security boundary. A shared URL
	//    carrying a foreign group id must not let the requester probe which of the items they can
	//    see are also in that group; so the group is only allowed to filter when the user is a
	//    member of it. Non-members / guests / garbage ids are silently dropped to `null`
	//    (mirroring how unknown `cats` values are ignored) — a shared link then just shows the
	//    unfiltered search, no error. Guests never call getAttachableGroups.
	const attachableGroups = locals.user ? await getAttachableGroups(locals.pb, locals.user.id) : [];
	if (
		searchParameters.selectedGroup &&
		!attachableGroups.some((g) => g.id === searchParameters.selectedGroup)
	) {
		searchParameters.selectedGroup = null;
	}

	// 3. Build PocketBase filter (group clause only present for a membership-validated id above)
	const filter = buildItemFilter(searchParameters, locals.user?.id);

	// 4. Fetch paginated items, sorted per `searchParameters.sort` (defaults to newest-first by
	//    creation date, so edits don't resurface old items).
	let result: ListResult<ItemPublic> = { page: 1, perPage: searchParameters.perPage, totalItems: 0, totalPages: 0, items: [] };
	try {
		result = await locals.pb.collection('items_searchable').getList<ItemPublic>(searchParameters.page, searchParameters.perPage, {
			sort: sortToPbSort(searchParameters.sort),
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

	// 5. Log search queries (fire-and-forget) — skip blank default browsing. The selected group
	//    is deliberately NOT logged: it's a private social-graph datum and the log only serves
	//    search-term statistics. The `hasQuery` condition is intentionally left untouched.
	if (hasQuery) {
		void locals.pb.collection('searches').create({
			query: searchParameters.query,
			categories: searchParameters.selectedCategories.join(','),
		});
	}

	return {
		items: result.items,
		PB_IMG_URL: pbUrl(),
		q: searchParameters.query,
		selectedCategories: searchParameters.selectedCategories,
		onlyAvailable: searchParameters.onlyAvailable,
		ownerType: searchParameters.ownerType,
		selectedGroup: searchParameters.selectedGroup,
		sort: searchParameters.sort,
		// Only id + name reach the client — never the `groups` column of items.
		attachableGroups: attachableGroups.map(({ id, name }) => ({ id, name })),
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
			// Fire-and-forget: the search UX doesn't wait on the save. The upsert is a
			// two-step (read then create/update), so swallow any rejection explicitly.
			void upsertUserPreferences(locals.pb, locals.user.id, { preferredTransportMode: mode }).catch(
				() => {}
			);
		}
	},
};
