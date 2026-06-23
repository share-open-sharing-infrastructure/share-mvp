import { error, fail } from '@sveltejs/kit';
import { PUBLIC_PB_URL } from '$env/static/public';
import type { Item, User } from '$lib/types/models.js';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import { createNotification, sendPushToUser } from '$lib/server/notifications';

export async function load({ params, locals }) {

	let profileUser: User;
	try {
		profileUser = await locals.pb.collection('users_public').getOne(params.id);
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		error(e.status === 404 ? 404 : 500, 'User not found');
	}

	let allItems: Item[] = [];
	try {
		allItems = await locals.pb.collection('items_public').getFullList({
			filter: locals.pb.filter('userId = {:userId}', { userId: params.id }),
			sort: '-updated'
		});
	} catch (err) {
		console.error('Failed to load items for user profile', err);
	}

	const currentUser = locals.user;
	const isOwnProfile = currentUser?.id === profileUser.id;
	const viewerTrustsProfile = currentUser?.trusts?.includes(profileUser.id) ?? false;
	// Does the profile owner trust the viewer? Resolved server-side so the owner's
	// full trusts list never leaves the server (users_public no longer exposes it).
	let profileTrustsViewer = false;
	if (currentUser) {
		try {
			await locals.pb
				.collection('users')
				.getFirstListItem(
					locals.pb.filter('id = {:pid} && trusts.id ?= {:vid}', { pid: profileUser.id, vid: currentUser.id }),
					{ fields: 'id' }
				);
			profileTrustsViewer = true;
		} catch {
			profileTrustsViewer = false;
		}
	}

	const publicItems = allItems.filter((item) => !item.trusteesOnly);
	const trustedItemsAll = allItems.filter((item) => item.trusteesOnly);
	// Owner is never in their own trusts array, so isOwnProfile must be checked separately
	const trustedItems = (profileTrustsViewer || isOwnProfile) ? trustedItemsAll : null;

	// items_public masks trustees-only items (name/image/description are NULL). The owner
	// and trusted viewers may see full details, read here from the trust-filtered
	// `items_searchable` view. We must take the image (and its `collectionId`) from that
	// view too: the file URL is built from `collectionId`, and items_public masks the
	// image to NULL, so a URL pointing at items_public 404s. items_searchable exposes the
	// un-masked file (same view search uses), so its file URL resolves in the browser.
	if (trustedItems && trustedItems.length > 0) {
		try {
			const full = await locals.pb.collection('items_searchable').getFullList({
				filter: locals.pb.filter('userId = {:ownerId} && trusteesOnly = true', { ownerId: profileUser.id }),
				fields: 'id,collectionId,name,image,externalImgUrl,externalUrl,description',
			});
			const byId = new Map(full.map((f) => [f.id, f] as const));
			for (const item of trustedItems) {
				const f = byId.get(item.id);
				if (!f) continue;
				item.collectionId = f.collectionId;
				item.name = f.name;
				item.image = f.image;
				item.externalImgUrl = f.externalImgUrl;
				item.externalUrl = f.externalUrl;
				item.description = f.description;
			}
		} catch (err) {
			console.error('Failed to load trusted item details', err);
		}
	}

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
	addTrust: async ({ params, locals }) => {
		if (!locals.user) return fail(401, { message: texts.errors.noPermission });
		if (params.id === locals.user.id) return fail(400, { message: texts.errors.noPermission });

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

	removeTrust: async ({ params, locals }) => {
		if (!locals.user) return fail(401, { message: texts.errors.noPermission });

		const profileUserId = params.id;
		const updatedTrusts = (locals.user.trusts || []).filter((id: string) => id !== profileUserId);
		try {
			await locals.pb.collection('users').update(locals.user.id, { trusts: updatedTrusts });
		} catch (err) {
			console.error('Failed to remove trust', err);
		}
	},
};
