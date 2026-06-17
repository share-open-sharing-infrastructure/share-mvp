import type PocketBase from 'pocketbase';
import { pbErrorMessage } from '$lib/server/itemArchive';
import { diffItems } from './diff';
import { loadExistingItems } from './pocketbase';
import { applyDiff } from './write';
import { noRetry, type Institution, type MappedItem, type RetryWrapper, type SyncSummary } from './types';

/**
 * Returns a zeroed-out `SyncSummary` for the given context name.
 *
 * @param contextName - Value to use for `SyncSummary.institution` (institution username, or an error context label).
 * @param errors - Optional initial error messages (e.g. when a fatal failure aborts the sync).
 */
export function makeSummary(contextName: string, errors: string[] = []): SyncSummary {
	return {
		institution: contextName,
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
 * Syncs a single institution: maps the source items (via `fetchItems`), diffs against
 * current DB state, then applies batched creates, updates, and archives.
 *
 * Aborts with zero writes if either `fetchItems` or the DB load throws.
 *
 * @param pb - PocketBase client.
 * @param institution - The institution to sync.
 * @param fetchItems - Integration-supplied callback producing the institution's full item set.
 * @param retry - Wrapper applied to DB reads/writes (superuser re-auth on 401); identity by default.
 * @returns A `SyncSummary` with per-operation counts and any error messages.
 */
export async function syncInstitution<I extends Institution>(
	pb: PocketBase,
	institution: I,
	fetchItems: (institution: I) => Promise<MappedItem[]>,
	retry: RetryWrapper = noRetry,
): Promise<SyncSummary> {
	const startTime = Date.now();
	const summary = makeSummary(institution.username);

	try {
		const mappedItems = await fetchItems(institution);
		summary.fetched = mappedItems.length;

		const existingItems = await retry(() => loadExistingItems(pb, institution.id));

		const diff = diffItems(mappedItems, existingItems);
		summary.skipped = diff.skipped;

		const writes = await applyDiff(pb, diff, retry);
		summary.created = writes.created;
		summary.updated = writes.updated;
		summary.archived = writes.archived;
		summary.errors.push(...writes.errors);
	} catch (err) {
		summary.errors.push(pbErrorMessage(err));
	} finally {
		summary.durationMs = Date.now() - startTime;
	}

	return summary;
}

/**
 * Syncs a list of institutions sequentially, isolating one institution's failure from the rest.
 * The generic building block a `PullIntegration` composes after discovering its institutions.
 *
 * @param pb - PocketBase client.
 * @param institutions - Institutions to sync.
 * @param fetchItems - Integration-supplied callback producing an institution's full item set.
 * @param retry - Wrapper applied to DB reads/writes; identity by default.
 * @returns One `SyncSummary` per institution.
 */
export async function syncInstitutions<I extends Institution>(
	pb: PocketBase,
	institutions: I[],
	fetchItems: (institution: I) => Promise<MappedItem[]>,
	retry: RetryWrapper = noRetry,
): Promise<SyncSummary[]> {
	const summaries: SyncSummary[] = [];
	for (const institution of institutions) {
		summaries.push(await syncInstitution(pb, institution, fetchItems, retry));
	}
	return summaries;
}
