import PocketBase from 'pocketbase';
import { PUBLIC_PB_URL } from '$env/static/public';
import { PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD } from '$env/static/private';
import { archiveDescription, DESCRIPTION_PREFIX, pbErrorMessage } from '$lib/server/itemArchive';
import { fetchAllItems, normalizeBaseUrl } from './client';
import { mapItem, type MappedItem } from './mapping';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Same batching constants as src/routes/user/import/+page.server.ts — stays under
// PocketBase's default *:create rate limit of 20/5s.
const UPDATE_BATCH = 50;
const CREATE_BATCH = 15;
const CREATE_PAUSE_MS = 5500;

export interface SyncSummary {
	institution: string;
	fetched: number;
	created: number;
	updated: number;
	archived: number;
	skipped: number;
	errors: string[];
	durationMs: number;
}

/** A `users` record configured as a leihbackend-synced institution. */
export interface SyncInstitution {
	id: string;
	username: string;
	city?: string;
	leihbackendUrl: string;
	leihbackendItemUrlTemplate?: string;
}

interface ExistingItem {
	id: string;
	externalId: string;
	name: string;
	description: string;
	status: 'available' | 'unavailable' | 'unknown';
	categories: string[];
	externalImgUrl: string;
	externalUrl: string;
	place: string;
}

let cachedClient: PocketBase | null = null;

/** Returns a cached, authenticated PocketBase superuser client, re-authenticating if needed. */
export async function getSuperuserClient(): Promise<PocketBase> {
	if (cachedClient?.authStore.isValid) {
		return cachedClient;
	}

	const client = new PocketBase(PUBLIC_PB_URL);
	await client.collection('_superusers').authWithPassword(PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD);
	cachedClient = client;
	return client;
}

/** Retries a PocketBase operation once after re-authenticating, if it fails with 401. */
async function withAuthRetry<T>(pb: PocketBase, operation: () => Promise<T>): Promise<T> {
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

function sameCategories(a: string[] | undefined, b: string[]): boolean {
	const aa = a ?? [];
	if (aa.length !== b.length) return false;
	const sa = [...aa].sort();
	const sb = [...b].sort();
	return sa.every((value, i) => value === sb[i]);
}

function hasChanged(existing: ExistingItem, mapped: MappedItem): boolean {
	return (
		existing.name !== mapped.name ||
		existing.description !== mapped.description ||
		existing.status !== mapped.status ||
		existing.externalImgUrl !== mapped.externalImgUrl ||
		existing.externalUrl !== mapped.externalUrl ||
		existing.place !== mapped.place ||
		!sameCategories(existing.categories, mapped.categories)
	);
}

function emptySummary(institution: string, errors: string[] = []): SyncSummary {
	return {
		institution,
		fetched: 0,
		created: 0,
		updated: 0,
		archived: 0,
		skipped: 0,
		errors,
		durationMs: 0,
	};
}

/**
 * Syncs a single institution's items from leihbackend per spec §3.2: fetch → map → diff →
 * batched create/update/archive. Aborts (zero writes) if fetching `item_public` fails.
 */
export async function syncInstitution(pb: PocketBase, institution: SyncInstitution): Promise<SyncSummary> {
	const start = Date.now();

	let fetched;
	try {
		fetched = await fetchAllItems(institution.leihbackendUrl);
	} catch (err) {
		const summary = emptySummary(institution.username, [pbErrorMessage(err)]);
		summary.durationMs = Date.now() - start;
		return summary;
	}

	const summary = emptySummary(institution.username);
	summary.fetched = fetched.length;

	const ctx = {
		baseUrl: normalizeBaseUrl(institution.leihbackendUrl),
		ownerId: institution.id,
		city: institution.city,
		urlTemplate: institution.leihbackendItemUrlTemplate,
	};
	const mapped = fetched.map((item) => mapItem(item, ctx));

	let existing: ExistingItem[] = [];
	try {
		existing = await withAuthRetry(pb, () =>
			pb.collection('items').getFullList<ExistingItem>({
				filter: `owner = "${institution.id}" && externalId != ""`,
				fields: 'id,externalId,name,description,status,categories,externalImgUrl,externalUrl,place',
			})
		);
	} catch (err) {
		summary.errors.push(pbErrorMessage(err));
		summary.durationMs = Date.now() - start;
		return summary;
	}

	const existingByExternalId = new Map(existing.map((item) => [item.externalId, item]));
	const seenExternalIds = new Set(mapped.map((item) => item.externalId));

	const toCreate: MappedItem[] = [];
	const toUpdate: Array<{ id: string; data: MappedItem }> = [];

	for (const item of mapped) {
		const existingRecord = existingByExternalId.get(item.externalId);
		if (!existingRecord) {
			toCreate.push(item);
		} else if (hasChanged(existingRecord, item)) {
			toUpdate.push({ id: existingRecord.id, data: item });
		} else {
			summary.skipped += 1;
		}
	}

	const toArchive = existing.filter((item) => {
		if (seenExternalIds.has(item.externalId)) return false;
		const alreadyArchived = item.status === 'unavailable' && item.description?.startsWith(DESCRIPTION_PREFIX);
		if (alreadyArchived) {
			summary.skipped += 1;
			return false;
		}
		return true;
	});

	// --- Updates ---
	for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
		const chunk = toUpdate.slice(i, i + UPDATE_BATCH);
		const batch = pb.createBatch();
		for (const { id, data } of chunk) {
			batch.collection('items').update(id, data);
		}
		try {
			await withAuthRetry(pb, () => batch.send());
			summary.updated += chunk.length;
		} catch (err) {
			summary.errors.push(`update batch: ${pbErrorMessage(err)}`);
		}
		if (i + UPDATE_BATCH < toUpdate.length) await delay(300);
	}

	// --- Creates ---
	for (let i = 0; i < toCreate.length; i += CREATE_BATCH) {
		const chunk = toCreate.slice(i, i + CREATE_BATCH);
		const batch = pb.createBatch();
		for (const item of chunk) {
			batch.collection('items').create(item);
		}
		try {
			await withAuthRetry(pb, () => batch.send());
			summary.created += chunk.length;
		} catch (err) {
			summary.errors.push(`create batch: ${pbErrorMessage(err)}`);
		}
		if (i + CREATE_BATCH < toCreate.length) await delay(CREATE_PAUSE_MS);
	}

	// --- Archive ---
	for (let i = 0; i < toArchive.length; i += UPDATE_BATCH) {
		const chunk = toArchive.slice(i, i + UPDATE_BATCH);
		const batch = pb.createBatch();
		for (const item of chunk) {
			batch.collection('items').update(item.id, {
				status: 'unavailable',
				description: archiveDescription(item.description),
			});
		}
		try {
			await withAuthRetry(pb, () => batch.send());
			summary.archived += chunk.length;
		} catch (err) {
			summary.errors.push(`archive batch: ${pbErrorMessage(err)}`);
		}
		if (i + UPDATE_BATCH < toArchive.length) await delay(300);
	}

	summary.durationMs = Date.now() - start;
	return summary;
}

/**
 * Syncs all institutions configured for leihbackend (`isInstitution = true && leihbackendUrl != ""`),
 * sequentially, isolating one institution's failure from the others.
 */
export async function syncAll(pb: PocketBase): Promise<SyncSummary[]> {
	let institutions: SyncInstitution[] = [];
	try {
		institutions = await withAuthRetry(pb, () =>
			pb.collection('users').getFullList<SyncInstitution>({
				filter: 'isInstitution = true && leihbackendUrl != ""',
				fields: 'id,username,city,leihbackendUrl,leihbackendItemUrlTemplate',
			})
		);
	} catch (err) {
		return [emptySummary('(institutions lookup)', [pbErrorMessage(err)])];
	}

	const summaries: SyncSummary[] = [];
	for (const institution of institutions) {
		try {
			summaries.push(await syncInstitution(pb, institution));
		} catch (err) {
			summaries.push(emptySummary(institution.username, [pbErrorMessage(err)]));
		}
	}
	return summaries;
}
