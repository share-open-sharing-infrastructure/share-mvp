import type PocketBase from 'pocketbase';
import { pbErrorMessage } from '$lib/server/itemArchive';
import { diffItems } from './diff';
import { loadExistingItems } from './pocketbase';
import { applyDiff } from './write';
import { noRetry, type Institution, type MappedItem, type RetryWrapper, type SyncSummary } from './types';

/**
 * If at least this fraction of an institution's stored items would be archived in one run,
 * the archive phase is skipped (creates/updates still apply). A transient empty or collapsed
 * feed (e.g. a source mid-migration returning a well-formed `{items: []}`) must not
 * mass-archive the catalogue. Counterpart of `REFRESH_ABORT_RATE` in ./refresh.
 */
const SYNC_ARCHIVE_ABORT_RATE = 0.5;

/**
 * Circuit-breaker for the full-sync archive phase: returns the error message to record
 * (and a signal to skip archiving) when the feed looks like an outage rather than a real
 * catalogue shrink, or `null` when archiving is safe.
 */
function archiveGuardError(fetchedCount: number, toArchiveCount: number, existingCount: number): string | null {
	if (existingCount === 0 || toArchiveCount === 0) return null;
	if (fetchedCount === 0) {
		return (
			`Archive phase skipped: source returned 0 items while ${existingCount} synced items exist ` +
			`(likely source outage) — nothing archived.`
		);
	}
	if (toArchiveCount / existingCount >= SYNC_ARCHIVE_ABORT_RATE) {
		return (
			`Archive phase skipped: ${toArchiveCount}/${existingCount} synced items would be archived ` +
			`(≥${SYNC_ARCHIVE_ABORT_RATE * 100}% — likely source outage). Creates/updates were applied. ` +
			`If the removal is intentional, archive the affected items manually.`
		);
	}
	return null;
}

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
 * Aborts with zero writes if either `fetchItems` or the DB load throws. Skips the archive
 * phase (recording an error) when the feed is empty or would archive at least
 * `SYNC_ARCHIVE_ABORT_RATE` of the stored items — see `archiveGuardError`.
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

		const guardError = archiveGuardError(mappedItems.length, diff.toArchive.length, existingItems.length);
		if (guardError) summary.errors.push(guardError);

		const writes = await applyDiff(pb, guardError ? { ...diff, toArchive: [] } : diff, retry);
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
