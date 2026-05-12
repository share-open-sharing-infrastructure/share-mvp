import { error, fail } from '@sveltejs/kit';
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

	// Strip fields that must not reach the client: sensitive data and fields not used by this page.
	const fieldsToStrip = [
		'email', 'trusts', 'geolocation', 'inviteCode', 'invitedBy',
		'hasOnboarded', 'telegramUsername', 'signalLink',
		'telegramVisibleToTrustedOnly', 'signalVisibleToTrustedOnly',
	];
	for (const field of fieldsToStrip) {
		delete (profileUser as unknown as Record<string, unknown>)[field];
	}

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
		if (!locals.user) {
			fail(401, { message: texts.errors.noPermission });
			return;
		}
		if (params.id === locals.user.id) {
			fail(400, { message: texts.errors.noPermission });
			return;
		}

		const profileUserId = params.id;
		const updatedTrusts = [...(locals.user.trusts || []), profileUserId];
		try {
			await locals.pb.collection('users').update(locals.user.id, { trusts: updatedTrusts });
		} catch (err) {
			console.error('Failed to add trust', err);
		}

		// Notify the newly trusted user — fire and forget.
		const adderName = locals.user.username ?? locals.user.name ?? texts.pages.itemDetail.unknownRequester;
		const notificationBody = texts.notifications.trustAdded(adderName);
		try {
			await createNotification(locals.pb, profileUserId, locals.user.id, 'trust_added', locals.user.id, notificationBody);
			await sendPushToUser(locals.pb, profileUserId, texts.notifications.pushTitle, notificationBody, `/users/${locals.user.id}`);
		} catch (err) {
			console.error('Trust notification failed', err);
		}
	},

	removeTrust: async ({ params, locals }): Promise<void> => {
		if (!locals.user) {
			fail(401, { message: texts.errors.noPermission });
			return;
		}

		const profileUserId = params.id;
		const updatedTrusts = (locals.user.trusts || []).filter((id: string) => id !== profileUserId);
		try {
			await locals.pb.collection('users').update(locals.user.id, { trusts: updatedTrusts });
		} catch (err) {
			console.error('Failed to remove trust', err);
		}
	},
};
