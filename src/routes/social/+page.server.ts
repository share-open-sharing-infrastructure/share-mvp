/* eslint-disable @typescript-eslint/no-explicit-any */
import { fail } from '@sveltejs/kit';
import type { User } from '$lib/types/models.js';
import { texts } from '$lib/texts';
import { createNotification, sendPushToUser } from '$lib/server/notifications.js';
import { generateInviteSlug } from '$lib/inviteSlug.js';

export async function load({ locals, url }) {
	let users: User[] = [];

	try {
		users = await locals.pb.collection('users').getFullList();
	} catch (error: Error | any) {
		console.error(error.message ? error.message : error);
	}

	const trusteeIds = new Set<string>(locals.user.trusts ?? []);
	const trustedByIds = new Set<string>(
		users.filter((u) => u.trusts?.includes(locals.user.id)).map((u) => u.id)
	);
	const allContactIds = new Set([...trusteeIds, ...trustedByIds]);

	const trustNetwork = users
		.filter((u) => allContactIds.has(u.id))
		.map((u) => ({
			id: u.id,
			username: u.username,
			profilePic: `https://ui-avatars.com/api/?name=${u.username}&background=random`,
			iTrustThem: trusteeIds.has(u.id),
			theyTrustMe: trustedByIds.has(u.id),
		}));

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

		try {
			await locals.pb.collection('users').update(locals.user.id, {
				trusts: [...(locals.user.trusts || []), newTrusteeId],
			});
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
		const toRemoveTrusteeId = formData.get('trusteeId');

		try {
			const updatedTrusts = (locals.user.trusts || []).filter(
				(id: string) => id !== toRemoveTrusteeId
			);
			await locals.pb
				.collection('users')
				.update(locals.user.id, { trusts: updatedTrusts });
		} catch (error: Error | any) {
			console.error(error ? error.message : error);
		}
	},
};
