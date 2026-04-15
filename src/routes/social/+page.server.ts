/* eslint-disable @typescript-eslint/no-explicit-any */
import type { User } from '$lib/types/models.js';
import { texts } from '$lib/texts';
import { createNotification, sendPushToUser } from '$lib/server/notifications.js';

export async function load({ locals }) {
	let trustees: User[] = [];
	let users: User[] = [];

	try {
		users = await locals.pb.collection('users').getFullList();
		trustees = users.filter(
			(user) => locals.user.trusts && locals.user.trusts.includes(user.id)
		);
	} catch (error: Error | any) {
		console.error(error.message ? error.message : error);
	}

	const trustedBy = users.filter((user) => user.trusts?.includes(locals.user.id));

	return {
		users: users,
		trustees:
			trustees.map((trustee) => ({
				...trustee,
				profilePic: `https://ui-avatars.com/api/?name=${trustee.username}&background=random`,
			})) ?? [],
		trustedBy: trustedBy.map((user) => ({
			id: user.id,
			username: user.username,
			profilePic: `https://ui-avatars.com/api/?name=${user.username}&background=random`,
		})),
	};
}

export const actions = {
	addTrustee: async ({ request, locals }): Promise<void> => {
		const formData = await request.formData();
		const newTrusteeId = formData.get('trusteeId');

		const updateData = {
			trusts: [...(locals.user.trusts || []), newTrusteeId],
		};

		try {
			await locals.pb.collection('users').update(locals.user.id, updateData);
		} catch (error: Error | any) {
			console.error(error ? error.message : error);
		}

		// Notify the newly trusted user
		const adderName = locals.user.username ?? locals.user.name ?? 'Jemand';
		const notificationBody = texts.notifications.trustAdded(adderName);

		await createNotification(locals.pb, newTrusteeId as string, locals.user.id, 'trust_added', locals.user.id, notificationBody);
		await sendPushToUser(locals.pb, newTrusteeId as string, texts.notifications.pushTitle, notificationBody, `/users/${locals.user.id}`);
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
