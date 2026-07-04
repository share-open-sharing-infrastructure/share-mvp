import type PocketBase from 'pocketbase';
import { pbErrorMessage } from '$lib/server/itemArchive';
import { diffItems } from './diff';
import { loadExistingItems } from './pocketbase';
import { makeSummary } from './sync';
import { applyDiff } from './write';
import {
	noRetry,
	type ExistingItem,
	type Institution,
	type MappedItem,
	type RefreshIntegration,
	type RetryWrapper,
	type SyncSummary,
} from './types';

/**
 * If at least this fraction of an institution's per-item fetches fail with a transient error
 * **or come back "gone"**, the whole institution is aborted with zero writes. Both signals
 * indicate a likely source outage: a renamed/removed source view 404s every record, and a
 * WebOPAC in maintenance can answer every barcode with an empty (but well-formed) result —
 * either would wrongly mass-archive the catalogue if trusted.
 */
const REFRESH_ABORT_RATE = 0.5;

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Refreshes a single institution's already-stored external items, one item at a time:
 * each item is routed to the `RefreshIntegration` that claims it and re-fetched from its source.
 *
 * - `found` items are diffed against the stored record and updated if changed.
 * - `gone` items (source no longer has them) are archived (via the normal diff archive path).
 * - `error` items (transient failures) are left untouched and counted toward the circuit-breaker.
 *
 * Aborts with zero writes if the DB load fails, or if the combined transient-error + gone
 * rate reaches `REFRESH_ABORT_RATE`.
 *
 * @param pb - PocketBase client.
 * @param institution - The institution whose stored items are refreshed.
 * @param integrations - Refresh integrations, tried in order via `claimsItem`.
 * @param retry - Wrapper applied to DB reads/writes (superuser re-auth on 401); identity by default.
 */
export async function refreshInstitution(
	pb: PocketBase,
	institution: Institution,
	integrations: RefreshIntegration[],
	retry: RetryWrapper = noRetry,
): Promise<SyncSummary> {
	const startTime = Date.now();
	const summary = makeSummary(institution.username);

	try {
		const existingItems = await retry(() => loadExistingItems(pb, institution.id));

		const fetched: MappedItem[] = [];
		const resolved: ExistingItem[] = []; // items with a definitive answer (found or gone)
		let goneCount = 0;

		// Narrow to the integrations serving this institution's source before item routing,
		// so a catch-all claimsItem can't grab (and archive) another source's items.
		const candidates = integrations.filter(
			(candidate) => candidate.claimsInstitution?.(institution) ?? true,
		);

		for (const item of existingItems) {
			const integration = candidates.find((candidate) => candidate.claimsItem(item));
			if (!integration) continue; // no integration owns this item — leave it untouched

			let outcome;
			try {
				outcome = await integration.fetchOne(institution, item);
			} catch (err) {
				outcome = { kind: 'error' as const, message: pbErrorMessage(err) };
			}

			if (outcome.kind === 'found') {
				fetched.push(outcome.item);
				resolved.push(item);
			} else if (outcome.kind === 'gone') {
				resolved.push(item);
				goneCount += 1;
			} else {
				summary.errors.push(outcome.message);
			}

			if (integration.pauseMsBetweenFetches) await delay(integration.pauseMsBetweenFetches);
		}

		summary.fetched = fetched.length;

		// Circuit-breaker: a likely outage — abort without archiving. "Gone" answers count too:
		// a collection-level 404 or an empty-but-well-formed source response reports every item
		// as gone, which must not be mistaken for a genuine mass-removal.
		const suspicious = summary.errors.length + goneCount;
		if (existingItems.length > 0 && suspicious / existingItems.length >= REFRESH_ABORT_RATE) {
			summary.errors.unshift(
				`Aborted: ${suspicious}/${existingItems.length} item fetches were suspicious ` +
					`(${summary.errors.length} transient errors, ${goneCount} reported gone) — likely source ` +
					`outage; nothing archived. If the removal is intentional, archive the items manually.`,
			);
			return summary;
		}

		const diff = diffItems(fetched, resolved);
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
 * Refreshes a list of institutions sequentially, isolating one institution's failure from the rest.
 *
 * @param pb - PocketBase client.
 * @param institutions - Institutions to refresh.
 * @param integrations - Refresh integrations, tried in order via `claimsItem`.
 * @param retry - Wrapper applied to DB reads/writes; identity by default.
 * @returns One `SyncSummary` per institution.
 */
export async function refreshInstitutions(
	pb: PocketBase,
	institutions: Institution[],
	integrations: RefreshIntegration[],
	retry: RetryWrapper = noRetry,
): Promise<SyncSummary[]> {
	const summaries: SyncSummary[] = [];
	for (const institution of institutions) {
		summaries.push(await refreshInstitution(pb, institution, integrations, retry));
	}
	return summaries;
}
