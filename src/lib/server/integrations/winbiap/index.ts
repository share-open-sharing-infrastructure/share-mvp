import type { ExistingItem, Institution, MappedItem, RefreshIntegration, RefreshOutcome } from '../core/types';
import { fetchItemStatus, normalizeBaseUrl } from './client';

/** The base URL field on the institution `users` record (currently the overloaded `leihbackendUrl`). */
interface WithBaseUrl {
	leihbackendUrl?: string;
}

/**
 * True for items that came from a WINBIAP WebOPAC: their deep link lives under `/webopac/`, and
 * their `externalId` is a `{libraryId}${Mediennummer}` barcode. The `externalId` check also catches
 * items imported without API enrichment, whose `externalUrl` is empty.
 */
function isWinbiapItem(item: ExistingItem): boolean {
	return (item.externalUrl ?? '').toLowerCase().includes('/webopac/') || (item.externalId ?? '').includes('$');
}

/** Builds a status-only `MappedItem`: the stored item's synced fields with `status` replaced. */
function withStatus(item: ExistingItem, status: MappedItem['status'], ownerId: string): MappedItem {
	return {
		externalId: item.externalId ?? '',
		name: item.name,
		description: item.description,
		categories: item.categories,
		place: item.place,
		externalUrl: item.externalUrl,
		externalImgUrl: item.externalImgUrl,
		status,
		owner: ownerId,
		trusteesOnly: false, // type-filler: not written on update (applyDiff updates only synced fields)
	};
}

/**
 * Re-fetches one stored WINBIAP item's availability from the WebOPAC and produces a status-only
 * update. No catalogue hit ⇒ `gone` (archive); a transient fetch failure throws (the refresh flow
 * records it as an error and leaves the item untouched).
 */
async function refreshOne(institution: Institution, item: ExistingItem): Promise<RefreshOutcome> {
	const baseUrl = (institution as WithBaseUrl).leihbackendUrl ?? '';
	const result = await fetchItemStatus(normalizeBaseUrl(baseUrl), item.externalId ?? '');
	if (!result.found) return { kind: 'gone' };
	return { kind: 'found', item: withStatus(item, result.status, institution.id) };
}

/** Refresh integration for WINBIAP WebOPAC items (status only). Registered first in `../registry`. */
export const winbiapRefreshIntegration: RefreshIntegration = {
	id: 'winbiap',
	claimsItem: isWinbiapItem,
	fetchOne: refreshOne,
	pauseMsBetweenFetches: 500, // spare the library WebOPAC from a burst of per-item requests
};

// Exported for unit testing.
export { isWinbiapItem };
