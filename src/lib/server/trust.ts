import type PocketBase from 'pocketbase';
import type { Trust, UserId } from '$lib/types/models';

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

/** Trust edges where `userId` is the truster, with the trustee expanded. */
export function getTrustees(pb: PocketBase, userId: UserId): Promise<Trust[]> {
	return pb.collection('trusts').getFullList<Trust>({
		filter: pb.filter('truster = {:u}', { u: userId }),
		expand: 'trustee',
	});
}

/** Trust edges where `userId` is the trustee, with the truster expanded. */
export function getTrusters(pb: PocketBase, userId: UserId): Promise<Trust[]> {
	return pb.collection('trusts').getFullList<Trust>({
		filter: pb.filter('trustee = {:u}', { u: userId }),
		expand: 'truster',
	});
}
