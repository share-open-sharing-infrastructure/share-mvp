/**
 * In-memory free-text predicate for item lists: matches an item whose `name` or `description`
 * contains the (already normalized) search string. Used to filter already-loaded items (profile,
 * group detail) client-side, so no extra request is needed.
 * @param item the item to test (name/description may be missing)
 * @param normalizedSearch the search string, expected pre-trimmed and lower-cased; an empty
 *   string matches every item
 */
export function matchesItemSearch(
	item: { name?: string | null; description?: string | null },
	normalizedSearch: string
): boolean {
	if (normalizedSearch === '') return true;
	return `${item.name ?? ''} ${item.description ?? ''}`.toLowerCase().includes(normalizedSearch);
}

/**
 * "Only available" predicate, matching the /search filter semantics: an item passes unless it
 * is explicitly marked `unavailable`, so both `available` and `unknown` (and missing) status
 * remain visible. Used by the group item list's availability toggle.
 */
export function isAvailable(item: { status?: string | null }): boolean {
	return item.status !== 'unavailable';
}
