import type PocketBase from 'pocketbase';
import { pbErrorMessage } from '$lib/server/itemArchive';
import { makeSummary } from './core/sync';
import type { PullIntegration, SyncSummary } from './core/types';
import { leihbackendIntegration } from './leihbackend';

/**
 * All scheduled-pull integrations. To add one, implement a `PullIntegration`
 * in its own folder and append it here — see docs/integrations.md.
 */
export const pullIntegrations: PullIntegration[] = [leihbackendIntegration];

/**
 * Runs every registered scheduled-pull integration and flattens their per-institution
 * summaries. A failure in one integration is isolated to a single error summary so the
 * others still run.
 *
 * @param pb - Authenticated PocketBase superuser client.
 * @returns One `SyncSummary` per synced institution across all integrations.
 */
export async function syncAll(pb: PocketBase): Promise<SyncSummary[]> {
	const summaries: SyncSummary[] = [];
	for (const integration of pullIntegrations) {
		try {
			summaries.push(...(await integration.syncAll(pb)));
		} catch (err) {
			summaries.push(makeSummary(`(${integration.id})`, [pbErrorMessage(err)]));
		}
	}
	return summaries;
}
