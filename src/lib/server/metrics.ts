import { getSuperuserClient } from './integrations/core/pocketbase';
import type { DailyMetrics, MetricsDaily } from '$lib/types/models';

// Business-metrics project: superuser-only reads of `metrics_daily` (nightly snapshots,
// see allerleih-backend jobs/metrics.js) plus cheap "live" counts computed on request so
// the admin dashboard's headline tiles are current-day, not yesterday's snapshot. See
// docs/operations/metrics.md for the full catalog.

/**
 * True iff the given user id has `users.isAdmin = true`. That field is `hidden: true`
 * on the backend (the base `users` collection's viewRule lets any authenticated user
 * view any other user's full row, so admin status must never come back on a normal
 * session's auth record) — only a superuser-authenticated request can read it, hence
 * the DB round-trip here rather than checking a field on `locals.user`. Set the flag
 * via the PocketBase admin UI, same as the existing `isInstitution` toggle.
 */
export async function isAdmin(userId: string | null | undefined): Promise<boolean> {
	if (!userId) return false;
	try {
		const pb = await getSuperuserClient();
		const user = await pb.collection('users').getOne(userId, { fields: 'id,isAdmin', requestKey: null });
		return !!user.isAdmin;
	} catch (err) {
		console.error('isAdmin check failed — treating as not admin', err);
		return false;
	}
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
	// requestKey: null opts out of the SDK's auto-cancellation, which dedupes by
	// collection+method regardless of filter — without this, the many concurrent
	// counts against the same collection (e.g. one per lendingStatus) would cancel
	// each other and throw "autocancelled" ClientResponseErrors.
	const { totalItems } = await pb.collection(collection).getList(1, 1, {
		filter: params ? pb.filter(filter, params) : filter,
		fields: 'id',
		requestKey: null,
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

/**
 * Nightly `metrics_daily` snapshots for the last `days` days, oldest first (for trend
 * charts). Fails soft (returns `[]`) instead of throwing: the frontend and backend repos
 * deploy independently, so this must not 500 `/admin/metrics` if the frontend lands
 * before the backend migration that creates `metrics_daily` — the live tiles should
 * still render. Any failure here (missing collection, auth hiccup, …) is logged but
 * treated as "no history yet", same as a genuinely empty collection.
 */
export async function getMetricsHistory(days: number): Promise<MetricsDaily[]> {
	try {
		const pb = await getSuperuserClient();
		const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
		return await pb.collection('metrics_daily').getFullList<MetricsDaily>({
			filter: pb.filter('date >= {:cutoff}', { cutoff }),
			sort: 'date',
			requestKey: null,
		});
	} catch (err) {
		console.error('getMetricsHistory failed — treating as no history yet', err);
		return [];
	}
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
 * Whitelisted headline subset for the public /misc/stats page AND the landing page
 * widget. Deliberately narrow — this is the ONLY place that decides what leaves the
 * superuser-only metrics_daily/live counts for unauthenticated eyes; do not widen it
 * without checking docs/operations/metrics.md.
 *
 * Fails soft (returns `null`) instead of throwing: this now renders on the homepage,
 * so a transient superuser-auth/DB hiccup must not take down the whole landing page —
 * callers should simply omit the stats section when this is null.
 */
export async function getPublicStats(): Promise<PublicStats | null> {
	if (cachedPublicStats && cachedPublicStats.expiresAt > Date.now()) {
		return cachedPublicStats.value;
	}

	try {
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
	} catch (err) {
		console.error('getPublicStats failed — omitting the stats section', err);
		return null;
	}
}

/** Test-only: clear the in-process public-stats cache between test cases. */
export function _resetPublicStatsCacheForTests(): void {
	cachedPublicStats = null;
}

export type { DailyMetrics };
