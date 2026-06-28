/**
 * In-memory free-text predicate for the profile item list: matches an item whose `name` or
 * `description` contains the (already normalized) search string. Used to filter the items that
 * are already loaded on the profile, so no extra request is needed.
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
