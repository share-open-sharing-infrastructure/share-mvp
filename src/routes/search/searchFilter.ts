import { ITEM_CATEGORIES, type ItemCategory } from '$lib/categories';
import type { ItemPublic } from '$lib/types/models';

export type SortOption = 'newest' | 'name_asc' | 'name_desc';

export type OwnerType = 'all' | 'institution' | 'private';

/** The full set of filter fields `FilterModal` edits as a local draft before committing them. */
export interface FilterDraft {
	sort: SortOption;
	onlyAvailable: boolean;
	ownerType: OwnerType;
	selectedCategories: string[];
	op: 'or' | 'and';
	selectedGroup: string | null;
}

export type SearchParameters = {
	query: string;
	page: number;
	perPage: number;
	selectedCategories: ItemCategory[];
	op: 'or' | 'and';
	onlyAvailable: boolean;
	ownerType: OwnerType;
	/**
	 * Raw, format-plausible group id parsed from the URL (or `null`). This is NOT yet a
	 * proven-membership id: `parseSearchParameters` stays pure/sync and only shape-checks it.
	 * The actual authorization — accept the group only if the user is a member — happens in the
	 * `load` (see `+page.server.ts`), which nulls it out otherwise. Building the filter clause on
	 * a validated value is therefore the caller's responsibility.
	 */
	selectedGroup: string | null;
	sort: SortOption;
};

const SORT_OPTIONS: SortOption[] = ['newest', 'name_asc', 'name_desc'];

/**
 * Maps a validated `SortOption` to the PocketBase `sort` query string for the
 * `items_searchable` view. `newest` (the default) sorts by creation date, descending, so edits
 * don't resurface old items.
 */
export function sortToPbSort(sort: SortOption): string {
	switch (sort) {
		case 'name_asc':
			return 'name';
		case 'name_desc':
			return '-name';
		case 'newest':
		default:
			return '-created';
	}
}

/**
 * Returns the field name as a string, validated at compile time against the `items_public` view schema.
 * Use this for every field reference in PocketBase filter strings so that renames are caught by TypeScript.
 */
function validateFilterField(field: keyof ItemPublic): string {
	return field;
}

/**
 * Converts a free-text search query into a PocketBase filter expression that matches items
 * whose `name`, `description` or owner `username` contains every whitespace-separated token
 * in the query. Including `username` lets users find an account's items by typing the account
 * (or institution) name directly, instead of guessing one of its items first.
 * @param raw the raw search string entered by the user
 * @returns a PocketBase filter string, or `null` for blank input or the wildcard `*`
 */
export function buildSearchFilter(raw: string): string | null {
	if (!raw || raw === '*') return null;
	const tokens = raw.trim().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return null;
	return tokens
		.map((token) => {
			const safe = token.replace(/"/g, '\\"');
			return `(${validateFilterField('name')} ~ "${safe}" || ${validateFilterField('description')} ~ "${safe}" || ${validateFilterField('username')} ~ "${safe}")`;
		})
		.join(' && ');
}

/**
 * Parses and validates all search-related URL parameters into a typed `SearchParams` object.
 * Invalid or missing values fall back to safe defaults; unrecognised category values are silently dropped.
 * @param url the request URL containing search parameters (`q`, `page`, `perPage`, `cats`, `op`, `onlyAvailable`, `ownerType`).
 *   `onlyAvailable` defaults to `false` (show all items) unless explicitly set to `true`.
 * @returns a fully typed `SearchParams` object with all fields guaranteed to be valid
 */
export function parseSearchParameters(url: URL): SearchParameters {
	const query = url.searchParams.get('q')?.trim() ?? '';
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get('perPage') ?? '20', 10) || 20));

	const catsParam = url.searchParams.get('cats') ?? '';
	const selectedCategories = catsParam
		.split(',')
		.map((s) => s.trim())
		.filter((s): s is ItemCategory => ITEM_CATEGORIES.includes(s as ItemCategory));

	const op: 'or' | 'and' = url.searchParams.get('op') === 'and' ? 'and' : 'or';
	const onlyAvailable = url.searchParams.get('onlyAvailable') === 'true';

	const ownerTypeParam = url.searchParams.get('ownerType') ?? 'all';
	const ownerType: OwnerType =
		ownerTypeParam === 'institution' || ownerTypeParam === 'private' ? ownerTypeParam : 'all';

	// Shape-check only: a PocketBase record id is 15 alphanumerics. Garbage is dropped to `null`
	// here (keeps injection/nonsense out of the load); the real authorization is the membership
	// check in the load. Not-a-member ids are also dropped there, mirroring how unknown `cats`
	// values are silently ignored.
	const groupParam = url.searchParams.get('group')?.trim() ?? '';
	const selectedGroup = /^[a-z0-9]{15}$/i.test(groupParam) ? groupParam : null;

	const sortParam = url.searchParams.get('sort') ?? 'newest';
	const sort: SortOption = SORT_OPTIONS.includes(sortParam as SortOption)
		? (sortParam as SortOption)
		: 'newest';

	return { query, page, perPage, selectedCategories, op, onlyAvailable, ownerType, selectedGroup, sort };
}

/**
 * Builds the complete PocketBase filter string for the `items_searchable` view by combining all
 * active search constraints (name, owner, categories, availability, owner type) with `&&`.
 * Trust-based visibility is enforced by the view's own rule, not here.
 * All field references are validated at compile time via `col()` against `ItemPublic`.
 * @param params the parsed search parameters produced by `parseSearchParameters`
 * @param userId the id of the logged-in user, or `undefined` if unauthenticated; used to exclude
 *   the user's own items from results
 * @returns a PocketBase filter string, or `undefined` if no constraints are active
 */
export function buildItemFilter(params: SearchParameters, userId?: string): string | undefined {
	const nameFilter = buildSearchFilter(params.query);
	const ownerFilter = userId ? `${validateFilterField('userId')} != "${userId}"` : null;

	// Escape & as \& so PocketBase's filter parser doesn't misinterpret it as the && operator.
	const escapeCategoryValue = (c: string) => c.replace(/&/g, '\\&');
	const categoryFilter =
		params.selectedCategories.length > 0
			? `(${params.selectedCategories.map((c) => `${validateFilterField('categories')} ~ '${escapeCategoryValue(c)}'`).join(params.op === 'and' ? ' && ' : ' || ')})`
			: null;

	// Trust visibility is enforced by the `items_searchable` view's rule (public items
	// for everyone; trustees-only items only for the owner and users they trust), so no
	// trust filter is applied here.
	const availabilityFilter = params.onlyAvailable ? `${validateFilterField('status')} != 'unavailable'` : null;

	const institutionFilter =
		params.ownerType === 'institution'
			? `${validateFilterField('isInstitution')} = true`
			: params.ownerType === 'private'
				? `${validateFilterField('isInstitution')} != true`
				: null;

	// `groups` is deliberately NOT part of `ItemPublic` — the column is never returned to
	// clients (see the `fields` allowlist in +page.server.ts), so `validateFilterField` can't be
	// used and we reference it as a string literal. Operator `~` matches the shipped group-detail
	// page (src/routes/user/groups/[id]/+page.server.ts) filtering the same `items_searchable`
	// view: PocketBase types the view's `groups` column as a relation, and `~` is the any-of
	// membership match. `params.selectedGroup` is already membership-validated by the load; the
	// quote-escape is defense-in-depth (the parser already restricts it to a 15-char id).
	const groupFilter = params.selectedGroup
		? `groups ~ "${params.selectedGroup.replace(/"/g, '\\"')}"`
		: null;

	return (
		[nameFilter, ownerFilter, categoryFilter, availabilityFilter, institutionFilter, groupFilter]
			.filter(Boolean)
			.join(' && ') || undefined
	);
}
