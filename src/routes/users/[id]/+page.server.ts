import { error } from '@sveltejs/kit';
import { PUBLIC_PB_URL } from '$env/static/public';
import type { Item, User } from '$lib/types/models.js';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import { createNotification, sendPushToUser } from '$lib/server/notifications';

export async function load({ params, locals }) {

	let profileUser: User;
	try {
		profileUser = await locals.pb.collection('users').getOne(params.id);
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		error(e.status === 404 ? 404 : 500, 'User not found');
	}

	let allItems: Item[] = [];
	try {
		allItems = await locals.pb.collection('items').getFullList({
			filter: `owner = "${params.id}"`,
			sort: '-updated',
			expand: 'owner',
		});
	} catch (err) {
		console.error('Failed to load items for user profile', err);
	}

	const currentUser = locals.user;
	const isOwnProfile = currentUser?.id === profileUser.id;
	const viewerTrustsProfile = currentUser?.trusts?.includes(profileUser.id) ?? false;
	const profileTrustsViewer = currentUser ? (profileUser.trusts?.includes(currentUser.id) ?? false) : false;

	const publicItems = allItems.filter((item) => !item.trusteesOnly);
	const trustedItemsAll = allItems.filter((item) => item.trusteesOnly);
	// Owner is never in their own trusts array, so isOwnProfile must be checked separately
	const trustedItems = (profileTrustsViewer || isOwnProfile) ? trustedItemsAll : null;

	return {
		profileUser,
		publicItems,
		trustedItems,
		hiddenItemsCount: trustedItems === null ? trustedItemsAll.length : 0,
		hiddenCategories: trustedItems === null ? trustedItemsAll.flatMap((i) => i.categories ?? []) : [],
		isOwnProfile,
		loggedIn: !!currentUser,
		viewerTrustsProfile,
		profileTrustsViewer,
		PB_IMG_URL: PUBLIC_PB_URL,
	};
}

export const actions = {
	addTrust: async ({ params, locals }): Promise<void> => {
		const profileUserId = params.id;
		const updatedTrusts = [...(locals.user.trusts || []), profileUserId];
		try {
			await locals.pb.collection('users').update(locals.user.id, { trusts: updatedTrusts });
		} catch (err) {
			console.error('Failed to add trust', err);
		}

		// Notify the newly trusted user
		const adderName = locals.user.username ?? locals.user.name ?? 'Jemand';
		const notificationBody = texts.notifications.trustAdded(adderName);

		await createNotification(locals.pb, profileUserId as string, locals.user.id, 'trust_added', locals.user.id, notificationBody);
		await sendPushToUser(locals.pb, profileUserId as string, texts.notifications.pushTitle, notificationBody, `/users/${locals.user.id}`);
	},
	removeTrust: async ({ params, locals }): Promise<void> => {
		const profileUserId = params.id;
		const updatedTrusts = (locals.user.trusts || []).filter((id: string) => id !== profileUserId);
		try {
			await locals.pb.collection('users').update(locals.user.id, { trusts: updatedTrusts });
		} catch (err) {
			console.error('Failed to remove trust', err);
		}
	},
};
