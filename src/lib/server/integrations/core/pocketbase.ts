import PocketBase from 'pocketbase';
import { PUBLIC_PB_URL } from '$env/static/public';
import { PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD } from '$env/static/private';
import { SYNCED_FIELDS, type ExistingItem } from './types';

/** PocketBase `fields` projection for an `ExistingItem`: the synced fields plus the keys. */
const EXISTING_ITEM_FIELDS = ['id', 'externalId', ...SYNCED_FIELDS].join(',');

let cachedSuperuserClient: PocketBase | null = null;

/**
 * Returns a cached, authenticated PocketBase superuser client.
 * Re-authenticates automatically if the cached session has expired.
 *
 * @returns An authenticated `PocketBase` instance valid for superuser operations.
 */
export async function getSuperuserClient(): Promise<PocketBase> {
	if (cachedSuperuserClient?.authStore.isValid) {
		return cachedSuperuserClient;
	}

	const newSuperuserClient = new PocketBase(PUBLIC_PB_URL);
	await newSuperuserClient.collection('_superusers').authWithPassword(PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD);
	cachedSuperuserClient = newSuperuserClient;
	return newSuperuserClient;
}

/**
 * Calls `operation()` and, on a 401 Unauthorized error, re-authenticates the superuser
 * session and retries once. All other errors are re-thrown immediately. Intended to be
 * partially applied into a `RetryWrapper` for scheduled-pull integrations.
 *
 * @param pb - Authenticated PocketBase client used to refresh the session on 401.
 * @param operation - The PocketBase operation to attempt, wrapped as a thunk.
 * @returns The resolved value of `operation`.
 */
export async function withAuthRetry<T>(pb: PocketBase, operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (err) {
		if ((err as { status?: number })?.status === 401) {
			await pb.collection('_superusers').authWithPassword(PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD);
			return await operation();
		}
		throw err;
	}
}

/**
 * Loads all externally-synced items owned by the given institution, with the full field
 * set needed for change detection and archiving.
 *
 * @param pb - PocketBase client (superuser for pull flows, user session for the import flow).
 * @param ownerId - PocketBase id of the owning institution's `users` record.
 * @returns All `items` records owned by `ownerId` that carry an `externalId`.
 */
export async function loadExistingItems(pb: PocketBase, ownerId: string): Promise<ExistingItem[]> {
	return pb.collection('items').getFullList<ExistingItem>({
		filter: `owner = "${ownerId}" && externalId != ""`,
		fields: EXISTING_ITEM_FIELDS,
	});
}
