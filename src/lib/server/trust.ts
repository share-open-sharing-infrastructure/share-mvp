import type PocketBase from 'pocketbase';
import type { Trust, UserId } from '$lib/types/models';
import { texts } from '$lib/texts';
import { createNotification, sendPushToUser } from '$lib/server/notifications';

// Central access point for the `trusts` join collection (replacing the old
// users.trusts[] array). A row {truster, trustee} means "truster trusts trustee":
// the trustee may see the truster's trusteesOnly items and trusted-only contact
// handles. Keeping every join query here means the visibility model has one place
// to read on the frontend side.

/** True iff a trust edge {truster, trustee} exists (i.e. truster trusts trustee). */
export async function isTrusting(pb: PocketBase, trusterId: UserId, trusteeId: UserId): Promise<boolean> {
	try {
		await pb
			.collection('trusts')
			.getFirstListItem(pb.filter('truster = {:tr} && trustee = {:te}', { tr: trusterId, te: trusteeId }), {
				fields: 'id',
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
