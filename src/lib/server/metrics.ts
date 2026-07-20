import { ADMIN_EMAILS } from '$env/static/private';
import { getSuperuserClient } from './integrations/core/pocketbase';
import type { DailyMetrics, MetricsDaily } from '$lib/types/models';

// Business-metrics project: superuser-only reads of `metrics_daily` (nightly snapshots,
// see allerleih-backend jobs/metrics.js) plus cheap "live" counts computed on request so
// the admin dashboard's headline tiles are current-day, not yesterday's snapshot. See
// docs/operations/metrics.md for the full catalog.

/** True iff `user`'s email is in the (comma-separated) `ADMIN_EMAILS` allowlist. */
export function isAdmin(user: { email?: string } | null | undefined): boolean {
	const allowlist = ADMIN_EMAILS.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
	if (allowlist.length === 0 || !user?.email) return false;
	return allowlist.includes(user.email.trim().toLowerCase());
}

const LENDING_STATUSES = [
	'pending',
	'accepted',
	'rejected',
	'active',
	'return_requested',
	'completed',
	'aborted',
] as const;

export interface LiveCoreMetrics {
	users: { total: number; institutions: number; verified: number };
	items: { available: number; byPrivateUsers: number; byInstitutionsNative: number; external: number };
	loans: Record<(typeof LENDING_STATUSES)[number], number>;
}

/** `getList(1, 1, …)` fetches nothing but the total count — cheap even on a large table. */
async function count(
	pb: Awaited<ReturnType<typeof getSuperuserClient>>,
	collection: string,
	filter: string,
	params?: Record<string, unknown>
): Promise<number> {
	const { totalItems } = await pb.collection(collection).getList(1, 1, {
		filter: params ? pb.filter(filter, params) : filter,
		fields: 'id',
	});
	return totalItems;
}

/** Cheap live counts for the admin dashboard's headline tiles (today, not last night's snapshot). */
export async function getLiveCoreMetrics(): Promise<LiveCoreMetrics> {
	const pb = await getSuperuserClient();

	const [total, institutions, verified, available, byPrivateUsers, byInstitutionsNative, external] =
		await Promise.all([
			count(pb, 'users', 'deleted != true'),
			count(pb, 'users', 'deleted != true && isInstitution = true'),
			count(pb, 'users', 'deleted != true && verified = true'),
			count(pb, 'items', 'status = "available"'),
			count(pb, 'items', 'status = "available" && owner.isInstitution != true'),
			count(pb, 'items', 'status = "available" && owner.isInstitution = true && externalId = ""'),
			count(pb, 'items', 'status = "available" && externalId != ""'),
		]);

	const loanEntries = await Promise.all(
		LENDING_STATUSES.map(
			async (status) => [status, await count(pb, 'conversations', 'lendingStatus = {:s}', { s: status })] as const
		)
	);

	return {
		users: { total, institutions, verified },
		items: { available, byPrivateUsers, byInstitutionsNative, external },
		loans: Object.fromEntries(loanEntries) as LiveCoreMetrics['loans'],
	};
}

/** Nightly `metrics_daily` snapshots for the last `days` days, oldest first (for trend charts). */
export async function getMetricsHistory(days: number): Promise<MetricsDaily[]> {
	const pb = await getSuperuserClient();
	const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
	return pb.collection('metrics_daily').getFullList<MetricsDaily>({
		filter: pb.filter('date >= {:cutoff}', { cutoff }),
		sort: 'date',
	});
}

export interface PublicStats {
	usersTotal: number;
	itemsAvailable: number;
	loansCompleted: number;
	/** Completed loans where the borrower said they'd have bought the item new otherwise. */
	impactWouldBuyCount: number;
}

const PUBLIC_STATS_CACHE_MS = 60 * 60 * 1000; // ~1h — /misc/stats must never hammer PocketBase
let cachedPublicStats: { value: PublicStats; expiresAt: number } | null = null;

/**
 * Whitelisted headline subset for the public /misc/stats page. Deliberately narrow — this
 * is the ONLY place that decides what leaves the superuser-only metrics_daily/live counts
 * for unauthenticated eyes; do not widen it without checking docs/operations/metrics.md.
 */
export async function getPublicStats(): Promise<PublicStats> {
	if (cachedPublicStats && cachedPublicStats.expiresAt > Date.now()) {
		return cachedPublicStats.value;
	}

	const pb = await getSuperuserClient();
	const [usersTotal, itemsAvailable, loansCompleted, impactWouldBuyCount] = await Promise.all([
		count(pb, 'users', 'deleted != true'),
		count(pb, 'items', 'status = "available"'),
		count(pb, 'conversations', 'lendingStatus = "completed"'),
		count(pb, 'conversations', 'lendingStatus = "completed" && counterfactual = "would_buy"'),
	]);

	const value: PublicStats = { usersTotal, itemsAvailable, loansCompleted, impactWouldBuyCount };
	cachedPublicStats = { value, expiresAt: Date.now() + PUBLIC_STATS_CACHE_MS };
	return value;
}

/** Test-only: clear the in-process public-stats cache between test cases. */
export function _resetPublicStatsCacheForTests(): void {
	cachedPublicStats = null;
}

export type { DailyMetrics };
