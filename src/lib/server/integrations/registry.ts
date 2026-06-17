import type PocketBase from 'pocketbase';
import { pbErrorMessage } from '$lib/server/itemArchive';
import { findSyncInstitutions, withAuthRetry } from './core/pocketbase';
import { refreshInstitutions } from './core/refresh';
import { makeSummary } from './core/sync';
import type { PullIntegration, RefreshIntegration, SyncSummary } from './core/types';
import { leihbackendIntegration, leihbackendRefreshIntegration } from './leihbackend';
import { winbiapRefreshIntegration } from './winbiap';

/**
 * All scheduled-pull integrations. To add one, implement a `PullIntegration`
 * in its own folder and append it here — see docs/integrations.md.
 */
export const pullIntegrations: PullIntegration[] = [leihbackendIntegration];

/**
 * All per-item refresh integrations, tried in order via `claimsItem` when routing each stored
 * item. More specific integrations come first; leihbackend is the catch-all default and stays last.
 */
export const refreshIntegrations: RefreshIntegration[] = [
	winbiapRefreshIntegration,
	leihbackendRefreshIntegration,
];

/**
 * Runs every registered scheduled-pull integration and flattens their per-institution
 * summaries. A failure in one integration is isolated to a single error summary so the
 * others still run.
 *
 * @param pocketBaseClient - Authenticated PocketBase superuser client.
 * @returns One `SyncSummary` per synced institution across all integrations.
 */
export async function runAllIntegrations(pocketBaseClient: PocketBase): Promise<SyncSummary[]> {
	const summaries: SyncSummary[] = [];
	for (const integration of pullIntegrations) {
		try {
			summaries.push(...(await integration.syncAll(pocketBaseClient)));
		} catch (err) {
			summaries.push(makeSummary(`(${integration.id})`, [pbErrorMessage(err)]));
		}
	}
	return summaries;
}

/**
 * Refreshes already-stored external items per item, routing each to the `RefreshIntegration`
 * that claims it. Discovers institutions once (shared, by base URL) and re-fetches the current
 * state of each stored item — updating changed ones and archiving those the source no longer has.
 *
 * @param pocketBaseClient - Authenticated PocketBase superuser client.
 * @param institutionId - Optional: refresh only this institution (else all configured ones).
 * @returns One `SyncSummary` per refreshed institution.
 */
export async function refreshAllIntegrations(
	pocketBaseClient: PocketBase,
	institutionId?: string,
): Promise<SyncSummary[]> {
	const institutions = await withAuthRetry(pocketBaseClient, () =>
		findSyncInstitutions(pocketBaseClient, institutionId),
	);

	if (institutionId && institutions.length === 0) {
		return [makeSummary(`(${institutionId})`, ['Institution not found or not configured for sync.'])];
	}

	return refreshInstitutions(pocketBaseClient, institutions, refreshIntegrations, (op) =>
		withAuthRetry(pocketBaseClient, op),
	);
}
