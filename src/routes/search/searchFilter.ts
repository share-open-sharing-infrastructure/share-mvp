import { ITEM_CATEGORIES, type ItemCategory } from '$lib/texts';
import type { ItemPublic } from '$lib/types/models';

export type SearchParameters = {
	query: string;
	page: number;
	perPage: number;
	selectedCategories: ItemCategory[];
	op: 'or' | 'and';
	onlyAvailable: boolean;
	ownerType: 'all' | 'institution' | 'private';
};

/**
 * Returns the field name as a string, validated at compile time against the `items_public` view schema.
 * Use this for every field reference in PocketBase filter strings so that renames are caught by TypeScript.
 */
function validateFilterField(field: keyof ItemPublic): string {
	return field;
}

/**
 * Converts a free-text search query into a PocketBase filter expression that matches items
 * whose `name` or `description` contains every whitespace-separated token in the query.
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
			return `(${validateFilterField('name')} ~ "${safe}" || ${validateFilterField('description')} ~ "${safe}")`;
		})
		.join(' && ');
}

/**
 * Parses and validates all search-related URL parameters into a typed `SearchParams` object.
 * Invalid or missing values fall back to safe defaults; unrecognised category values are silently dropped.
 * @param url the request URL containing search parameters (`q`, `page`, `perPage`, `cats`, `op`, `onlyAvailable`, `ownerType`)
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
	const onlyAvailable = url.searchParams.get('onlyAvailable') !== 'false';

	const ownerTypeParam = url.searchParams.get('ownerType') ?? 'all';
	const ownerType: 'all' | 'institution' | 'private' =
		ownerTypeParam === 'institution' || ownerTypeParam === 'private' ? ownerTypeParam : 'all';

	return { query, page, perPage, selectedCategories, op, onlyAvailable, ownerType };
}

/**
 * Builds the complete PocketBase filter string for the `items_public` view by combining all
 * active search constraints (name, owner, categories, trust, availability, owner type) with `&&`.
 * All field references are validated at compile time via `col()` against `ItemPublic`.
 * @param params the parsed search parameters produced by `parseSearchParameters`
 * @param userId the id of the logged-in user, or `undefined` if unauthenticated; used to exclude
 *   the user's own items and to apply trust-based visibility rules
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

	const trustFilter = userId
		? `(${validateFilterField('trusteesOnly')} = false || ${validateFilterField('trusts')} ~ "${userId}")`
		: `${validateFilterField('trusteesOnly')} = false`;

	const availabilityFilter = params.onlyAvailable ? `${validateFilterField('status')} != 'unavailable'` : null;

	const institutionFilter =
		params.ownerType === 'institution'
			? `${validateFilterField('isInstitution')} = true`
			: params.ownerType === 'private'
				? `${validateFilterField('isInstitution')} != true`
				: null;

	return (
		[nameFilter, ownerFilter, categoryFilter, trustFilter, availabilityFilter, institutionFilter]
			.filter(Boolean)
			.join(' && ') || undefined
	);
}
