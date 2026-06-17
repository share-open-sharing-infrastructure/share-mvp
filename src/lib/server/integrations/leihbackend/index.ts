import type PocketBase from 'pocketbase';
import { withAuthRetry } from '../core/pocketbase';
import { syncInstitutions } from '../core/sync';
import type { Institution, MappedItem, PullIntegration } from '../core/types';
import { fetchAllItems, normalizeBaseUrl } from './client';
import { mapItem } from './mapping';

/** A `users` record configured as a leihbackend-synced institution. */
export interface LeihbackendInstitution extends Institution {
	leihbackendUrl: string;
	leihbackendItemUrlTemplate?: string;
}

/**
 * Finds all institutions configured for leihbackend: `isInstitution = true` and a
 * non-empty `leihbackendUrl`. This discovery filter is the only place that references
 * leihbackend-specific user fields.
 */
async function findLeihbackendInstitutions(pb: PocketBase): Promise<LeihbackendInstitution[]> {
	return pb.collection('users').getFullList<LeihbackendInstitution>({
		filter: 'isInstitution = true && leihbackendUrl != ""',
		fields: 'id,username,city,leihbackendUrl,leihbackendItemUrlTemplate',
	});
}

/**
 * Fetches an institution's full leihbackend catalogue and maps it to AllerLeih's item schema.
 * Throws on network or API failure (the sync then aborts with zero writes for that institution).
 */
async function fetchAndMapItems(institution: LeihbackendInstitution): Promise<MappedItem[]> {
	const baseUrl = normalizeBaseUrl(institution.leihbackendUrl);
	const remoteFeed = await fetchAllItems(baseUrl);
	const mappingContext = {
		baseUrl,
		ownerId: institution.id,
		city: institution.city,
		urlTemplate: institution.leihbackendItemUrlTemplate,
	};
	return remoteFeed.map((remoteItem) => mapItem(remoteItem, mappingContext));
}

/** Scheduled-pull integration for leihbackend instances. Registered in `../registry`. */
export const leihbackendIntegration: PullIntegration = {
	id: 'leihbackend',
	async syncAll(pb) {
		const institutions = await withAuthRetry(pb, () => findLeihbackendInstitutions(pb));
		return syncInstitutions(pb, institutions, fetchAndMapItems, (op) => withAuthRetry(pb, op));
	},
};

// Exported for unit testing.
export { findLeihbackendInstitutions, fetchAndMapItems };
