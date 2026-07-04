import { findSyncInstitutions, withAuthRetry } from '../core/pocketbase';
import { syncInstitutions } from '../core/sync';
import type {
	ExistingItem,
	Institution,
	MappedItem,
	PullIntegration,
	RefreshIntegration,
	RefreshOutcome,
	SyncInstitution,
} from '../core/types';
import { isWinbiapInstitution } from '../winbiap';
import { fetchAllItems, fetchItemById, normalizeBaseUrl } from './client';
import { mapItem } from './mapping';

/**
 * Fetches an institution's full leihbackend catalogue and maps it to AllerLeih's item schema.
 * Throws on network or API failure (the sync then aborts with zero writes for that institution).
 * Records with an empty/missing name are skipped (one bad source record must not crash or
 * pollute the whole institution's sync).
 */
async function fetchAndMapItems(institution: SyncInstitution): Promise<MappedItem[]> {
	const mappingContext = mappingContextFor(institution);
	const remoteFeed = await fetchAllItems(mappingContext.baseUrl);
	return remoteFeed
		.map((remoteItem) => mapItem(remoteItem, mappingContext))
		.filter((item) => {
			if (item.name !== '') return true;
			console.error(`[sync] ${institution.username}: skipping nameless source record ${item.externalId}`);
			return false;
		});
}

/** Scheduled-pull integration for leihbackend instances. Registered in `../registry`. */
export const leihbackendIntegration: PullIntegration = {
	id: 'leihbackend',
	async syncAll(pb) {
		const institutions = await withAuthRetry(pb, () => findSyncInstitutions(pb));
		return syncInstitutions(pb, institutions, fetchAndMapItems, (op) => withAuthRetry(pb, op));
	},
};

/** Builds the per-item mapping context from an institution (shared by full sync and refresh). */
function mappingContextFor(institution: SyncInstitution) {
	return {
		baseUrl: normalizeBaseUrl(institution.leihbackendUrl),
		ownerId: institution.id,
		city: institution.city,
		urlTemplate: institution.leihbackendItemUrlTemplate,
	};
}

/**
 * Re-fetches one stored item from leihbackend by its record id and re-maps all fields.
 * A 404 means the record is gone (→ archive); any other failure is transient (→ leave as-is).
 */
async function refreshOne(institution: Institution, item: ExistingItem): Promise<RefreshOutcome> {
	const syncInstitution = institution as SyncInstitution;
	const record = await fetchItemById(normalizeBaseUrl(syncInstitution.leihbackendUrl), item.externalId ?? '');
	if (!record) return { kind: 'gone' };
	return { kind: 'found', item: mapItem(record, mappingContextFor(syncInstitution)) };
}

/**
 * Refresh integration for leihbackend. Within a leihbackend institution it claims every
 * item (catch-all, registered last) — but never items of a WINBIAP institution, where a
 * catch-all would 404 against `item_public` and wrongly archive them.
 */
export const leihbackendRefreshIntegration: RefreshIntegration = {
	id: 'leihbackend',
	claimsInstitution: (institution) => !isWinbiapInstitution(institution),
	claimsItem: () => true,
	fetchOne: refreshOne,
};

// Exported for unit testing.
export { fetchAndMapItems };
