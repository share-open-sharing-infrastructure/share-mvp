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

	// Deleted (anonymized) account: render a minimal tombstone. Skip all item and
	// trust-graph queries — there is nothing left to show.
	if (profileUser.deleted) {
		// The row is already anonymized (empty bio/profileImage, placeholder username),
		// so it's safe to pass through; the page renders only a tombstone.
		return {
			profileUser,
			isDeleted: true,
			publicItems: [],
			trustedItems: null,
			hiddenItemsCount: 0,
			hiddenCategories: [],
			isOwnProfile: false,
			loggedIn: !!locals.user,
			viewerTrustsProfile: false,
			profileTrustsViewer: false,
			PB_IMG_URL: PUBLIC_PB_URL,
		};
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

	// items_public masks RESTRICTED items (trustees-only OR group-shared): their
	// name comes back NULL. Unmasked rows are public.
	const publicItems = allItems.filter((item) => item.name != null);
	const restrictedAll = allItems.filter((item) => item.name == null);

	// Reveal the restricted ones THIS viewer may actually read: owner/trusted get
	// their trustees items, group members get items shared with a group they're in.
	// We read from `items_searchable` (NOT base `items`): its rule grants only the
	// real audience (trust + group), so it deliberately EXCLUDES items the viewer
	// can merely see via an existing conversation — those must not surface on the
	// profile. The masked list is then filtered to these and un-masked. We also pull
	// `collectionId` so the image file URL resolves (items_public masks the image to
	// NULL, so a URL built from that row would 404).
	let trustedItems: typeof restrictedAll | null = null;
	if (restrictedAll.length > 0 && currentUser) {
		try {
			const full = await locals.pb.collection('items_searchable').getFullList({
				filter: locals.pb.filter('userId = {:ownerId}', { ownerId: profileUser.id }),
				fields: 'id,collectionId,name,image,externalImgUrl,externalUrl,description',
			});
			const byId = new Map(full.map((f) => [f.id, f] as const));
			const accessible = restrictedAll.filter((item) => byId.has(item.id));
			for (const item of accessible) {
				const f = byId.get(item.id)!;
				item.collectionId = f.collectionId;
				item.name = f.name;
				item.image = f.image;
				item.externalImgUrl = f.externalImgUrl;
				item.externalUrl = f.externalUrl;
				item.description = f.description;
			}
			if (accessible.length > 0) trustedItems = accessible;
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
		hiddenItemsCount: trustedItems === null ? restrictedAll.length : 0,
		hiddenCategories: trustedItems === null ? restrictedAll.flatMap((i) => i.categories ?? []) : [],
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

		// Cannot trust a deleted (anonymized) account.
		try {
			const target = await locals.pb.collection('users_public').getOne(params.id);
			if (target.deleted) return fail(400, { message: texts.account.cannotTrustDeleted });
		} catch {
			return fail(404, { message: texts.errors.noPermission });
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
