import type PocketBase from 'pocketbase';
import type { Trust, UserId } from '$lib/types/models';
import { texts } from '$lib/texts';
import { createNotification, sendPushToUser } from '$lib/server/notifications';

// Central access point for the `trusts` join collection (replacing the old
// users.trusts[] array). A row {truster, trustee} means "truster trusts trustee":
// the trustee may see the truster's trusteesOnly items and trusted-only contact
// handles. Keeping every join query here means the visibility model has one place
// to read on the frontend side.

/**
 * True iff a trust edge {truster, trustee} exists (i.e. truster trusts trustee).
 *
 * ONE direction only — for both directions use `getTrustDirections`, never two
 * concurrent `isTrusting` calls on the same `pb`: they share a `method + path`, so
 * PocketBase auto-cancels the first and the `catch` below reports the abort as a
 * plain `false` (see `getTrustDirections`' doc comment). `requestKey` exists for the
 * same reason as on `getTrustees`/`getTrusters` — override it at any call site that
 * runs concurrently with another `trusts` read.
 */
export async function isTrusting(
	pb: PocketBase,
	trusterId: UserId,
	trusteeId: UserId,
	requestKey = 'is-trusting'
): Promise<boolean> {
	try {
		await pb
			.collection('trusts')
			.getFirstListItem(pb.filter('truster = {:tr} && trustee = {:te}', { tr: trusterId, te: trusteeId }), {
				fields: 'id',
				requestKey,
			});
		return true;
	} catch {
		return false;
	}
}

/** Create a trust edge (truster trusts trustee). Idempotent: an existing edge or a
 *  self-edge is a no-op, so re-adding never surfaces an error — even under a
 *  concurrent double-submit, where the check-then-create guard can be raced and the
 *  second create hits the UNIQUE(truster, trustee) index. */
export async function addTrust(pb: PocketBase, trusterId: UserId, trusteeId: UserId): Promise<void> {
	if (trusterId === trusteeId) return;
	if (await isTrusting(pb, trusterId, trusteeId)) return;
	try {
		await pb.collection('trusts').create({ truster: trusterId, trustee: trusteeId });
	} catch (err) {
		// A concurrent add can slip past isTrusting() and violate the unique index. If the
		// edge exists now, the intent is satisfied — treat it as a no-op; otherwise rethrow.
		if (!(await isTrusting(pb, trusterId, trusteeId))) throw err;
	}
}

export type AddTrustResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * The full "trust someone" flow shared by /social, /users/[id] and onboarding:
 * refuses deleted (anonymized) targets, creates the trust edge, then notifies the
 * new trustee (in-app + push).
 *
 * An edge-creation failure is returned as an error so callers surface a fail()
 * instead of pretending success; a notification failure is non-fatal (the edge
 * exists — which is what the caller's UI reflects) and only logged.
 */
export async function addTrustAndNotify(
	pb: PocketBase,
	truster: { id: UserId; username?: string; name?: string },
	trusteeId: UserId
): Promise<AddTrustResult> {
	// Cannot trust a deleted (anonymized) account.
	try {
		const target = await pb.collection('users_public').getOne(trusteeId, { fields: 'id,deleted' });
		if (target.deleted) {
			return { ok: false, status: 400, message: texts.account.cannotTrustDeleted };
		}
	} catch {
		return { ok: false, status: 404, message: texts.errors.somethingWentWrong };
	}

	try {
		await addTrust(pb, truster.id, trusteeId);
	} catch (err) {
		console.error('Failed to add trust', err instanceof Error ? err.message : err);
		return { ok: false, status: 500, message: texts.errors.somethingWentWrong };
	}

	const adderName = truster.username ?? truster.name ?? texts.pages.itemDetail.unknownRequester;
	const notificationBody = texts.notifications.trustAdded(adderName);
	try {
		await createNotification(pb, trusteeId, truster.id, 'trust_added', truster.id, notificationBody);
		await sendPushToUser(pb, trusteeId, texts.notifications.pushTitle, notificationBody, `/users/${truster.id}`);
	} catch (err) {
		console.error('Trust notification failed', err instanceof Error ? err.message : err);
	}

	return { ok: true };
}

/** Remove the trust edge {truster, trustee} if it exists. */
export async function removeTrust(pb: PocketBase, trusterId: UserId, trusteeId: UserId): Promise<void> {
	try {
		const row = await pb
			.collection('trusts')
			.getFirstListItem(pb.filter('truster = {:tr} && trustee = {:te}', { tr: trusterId, te: trusteeId }), {
				fields: 'id',
			});
		await pb.collection('trusts').delete(row.id);
	} catch {
		// no such edge — nothing to remove
	}
}

/** Both trust directions between a viewer and the other user, named from the viewer's
 *  perspective so a swapped argument pair can't silently invert the whole display. */
export type TrustDirections = { viewerTrustsOther: boolean; otherTrustsViewer: boolean };

/** Fail-closed result for `getTrustDirections` — no trust either direction. Shared so
 *  callers' anonymous-viewer and error fallbacks all point at one literal. Frozen at
 *  runtime, not just `as const`: this module-global object is handed to every caller in
 *  a long-lived Node process, so a single stray write would poison the fallback for all
 *  subsequent requests. */
export const NO_TRUST_DIRECTIONS: Readonly<TrustDirections> = Object.freeze({
	viewerTrustsOther: false,
	otherTrustsViewer: false,
});

/**
 * Both trust directions between two users in ONE request: whether `viewerId` trusts
 * `otherId` and whether `otherId` trusts `viewerId`.
 *
 * Why one query instead of two concurrent `isTrusting()` calls: the PocketBase JS
 * SDK auto-cancels an in-flight request when a second one hits the same
 * `method + path` and no distinct `requestKey` is given (see
 * `pocketbase.es.mjs`: `requestKey || method + path`). Both directions of
 * `isTrusting` hit the identical `GET /api/collections/trusts/records` path, so a
 * naive `Promise.all([isTrusting(viewer, other), isTrusting(other, viewer)])` makes
 * the SDK abort the first call — and `isTrusting`'s `catch` swallows that
 * `AbortError` and returns `false`, silently reporting "no trust" even when the edge
 * exists. Giving each call a distinct `requestKey` would dodge the cancellation, but
 * still costs two round-trips; querying both directions in a single `getList` avoids
 * the race entirely and is cheaper. See also the `getUserPreferences` doc comment for
 * the same bug class.
 *
 * `requestKey` defaults to a stable value but MUST be overridden per concurrent
 * call site on the same `pb` (mirrors `getUserPreferences`) — two calls sharing a
 * key would re-trigger exactly the collision this function exists to avoid.
 */
export async function getTrustDirections(
	pb: PocketBase,
	viewerId: UserId,
	otherId: UserId,
	requestKey = 'trust-directions'
): Promise<Readonly<TrustDirections>> {
	try {
		// Page size 2 is safe because `UNIQUE (truster, trustee)` (docs/data-model.md
		// → "trusts") guarantees at most one row per direction, so at most 2 rows can
		// ever match this two-direction filter — a third OR branch here would need a
		// bigger page or it could silently truncate a row into a wrong `false`.
		const { items } = await pb.collection('trusts').getList(1, 2, {
			filter: pb.filter(
				'(truster={:viewer} && trustee={:other}) || (truster={:other} && trustee={:viewer})',
				{ viewer: viewerId, other: otherId }
			),
			fields: 'truster,trustee',
			requestKey,
			// Only `items` is read below, never `totalItems` — skip the COUNT query PocketBase
			// would otherwise run on every trust lookup on the item detail and profile pages.
			skipTotal: true,
		});
		let viewerTrustsOther = false;
		let otherTrustsViewer = false;
		for (const row of items) {
			if (row.truster === viewerId && row.trustee === otherId) viewerTrustsOther = true;
			if (row.truster === otherId && row.trustee === viewerId) otherTrustsViewer = true;
		}
		return { viewerTrustsOther, otherTrustsViewer };
	} catch (err) {
		// Unlike isTrusting()'s catch (which loses only one direction), this loses
		// both — log so a real failure (vs. "no rows") doesn't vanish silently.
		console.error('getTrustDirections failed', err instanceof Error ? err.message : err);
		return NO_TRUST_DIRECTIONS;
	}
}

// getTrustees + getTrusters both hit the `trusts` collection and are typically awaited
// together (e.g. Promise.all on /social). PocketBase auto-cancellation keys concurrent
// requests by path, so without distinct requestKeys the second would cancel the first —
// leaving one side of the network silently empty. Give each a stable, distinct key.

/** Trust edges where `userId` is the truster, with the trustee expanded. */
export function getTrustees(pb: PocketBase, userId: UserId): Promise<Trust[]> {
	return pb.collection('trusts').getFullList<Trust>({
		filter: pb.filter('truster = {:u}', { u: userId }),
		expand: 'trustee',
		requestKey: 'trust-trustees',
	});
}

/** Trust edges where `userId` is the trustee, with the truster expanded. */
export function getTrusters(pb: PocketBase, userId: UserId): Promise<Trust[]> {
	return pb.collection('trusts').getFullList<Trust>({
		filter: pb.filter('trustee = {:u}', { u: userId }),
		expand: 'truster',
		requestKey: 'trust-trusters',
	});
}
