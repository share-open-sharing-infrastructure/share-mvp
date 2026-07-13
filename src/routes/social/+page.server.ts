/* eslint-disable @typescript-eslint/no-explicit-any */
import { fail } from '@sveltejs/kit';
import type { User } from '$lib/types/models.js';
import { texts } from '$lib/texts';
import { createNotification, sendPushToUser } from '$lib/server/notifications.js';
import { addTrust, removeTrust, getTrustees, getTrusters } from '$lib/server/trust.js';
import { generateInviteSlug } from '$lib/inviteSlug.js';

export async function load({ locals, url }) {
	let users: Pick<User, 'id' | 'username'>[] = [];

	try {
		// Exclude deleted (anonymized) accounts so they can't be found/added as trustees.
		// Project to only the columns the trustee picker needs, so private base-`users`
		// fields (contactEmail, login email, inviteCode, …) are never serialized to the
		// client (#438 hardening).
		users = await locals.pb.collection('users').getFullList({
			filter: locals.pb.filter('deleted != true'),
			fields: 'id,username',
		});
	} catch (error: Error | any) {
		console.error(error.message ? error.message : error);
	}

	// Build the bidirectional trust network from the join: edges where I am the
	// truster ("I trust them") and edges where I am the trustee ("they trust me").
	// Deleted (anonymized) counterparts are skipped so they never surface here.
	const network = new Map<string, { username: string; iTrustThem: boolean; theyTrustMe: boolean }>();
	try {
		const [trustees, trusters] = await Promise.all([
			getTrustees(locals.pb, locals.user.id),
			getTrusters(locals.pb, locals.user.id),
		]);
		for (const t of trustees) {
			const u = t.expand?.trustee;
			if (!u || u.deleted) continue;
			network.set(u.id, { username: u.username, iTrustThem: true, theyTrustMe: false });
		}
		for (const t of trusters) {
			const u = t.expand?.truster;
			if (!u || u.deleted) continue;
			const existing = network.get(u.id);
			if (existing) existing.theyTrustMe = true;
			else network.set(u.id, { username: u.username, iTrustThem: false, theyTrustMe: true });
		}
	} catch (error: Error | any) {
		console.error(error.message ? error.message : error);
	}

	const trustNetwork = [...network].map(([id, v]) => ({
		id,
		username: v.username,
		profilePic: `https://ui-avatars.com/api/?name=${v.username}&background=random`,
		iTrustThem: v.iTrustThem,
		theyTrustMe: v.theyTrustMe,
	}));

	// Lazily create an invite code: most users will already have one from onboarding,
	// so we only hit the DB to generate + persist when the field is empty.
	let inviteCode = locals.user.inviteCode as string | undefined;
	if (!inviteCode) {
		inviteCode = await generateInviteSlug(locals.pb);
		await locals.pb.collection('users').update(locals.user.id, { inviteCode });
	}
	const inviteUrl = `${url.origin}/invite/${inviteCode}`;

	return {
		users,
		currentUser: { id: locals.user.id },
		trustNetwork,
		inviteUrl,
		username: locals.user.username as string,
	};
}

export const actions = {
	addTrustee: async ({ request, locals }) => {
		const formData = await request.formData();
		const newTrusteeId = formData.get('trusteeId') as string;
		const newTrusteeUsername = formData.get('trusteeUsername') as string | null;

		// Cannot trust a deleted (anonymized) account.
		try {
			const target = await locals.pb.collection('users_public').getOne(newTrusteeId);
			if (target.deleted) return fail(400, { fail: true, message: texts.account.cannotTrustDeleted });
		} catch {
			return fail(404, { fail: true, message: texts.errors.somethingWentWrong });
		}

		try {
			await addTrust(locals.pb, locals.user.id, newTrusteeId);
		} catch (error: Error | any) {
			console.error(error ? error.message : error);
			return fail(500, { fail: true, message: texts.errors.somethingWentWrong });
		}

		const adderName = locals.user.username ?? locals.user.name ?? 'Jemand';
		const notificationBody = texts.notifications.trustAdded(adderName);

		await createNotification(locals.pb, newTrusteeId, locals.user.id, 'trust_added', locals.user.id, notificationBody);
		await sendPushToUser(locals.pb, newTrusteeId, texts.notifications.pushTitle, notificationBody, `/users/${locals.user.id}`);

		return {
			success: true,
			message: texts.success.trusteeAdded(newTrusteeUsername ?? newTrusteeId),
		};
	},
	removeTrustee: async ({ request, locals }): Promise<void> => {
		const formData = await request.formData();
		const toRemoveTrusteeId = formData.get('trusteeId') as string;

		try {
			await removeTrust(locals.pb, locals.user.id, toRemoveTrusteeId);
		} catch (error: Error | any) {
			console.error(error ? error.message : error);
		}
	},
};
