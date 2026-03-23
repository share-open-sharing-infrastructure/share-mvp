import { error, redirect } from '@sveltejs/kit';
import { PUBLIC_PB_URL } from '$env/static/public';
import type { Item, User } from '$lib/types/models.js';
import type { ClientResponseError } from 'pocketbase';

export async function load({ params, locals }) {
	if (!locals.pb.authStore.isValid) {
		redirect(307, `/auth/login?redirectTo=/users/${params.id}`);
	}

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
	const isOwnProfile = currentUser.id === profileUser.id;
	const viewerTrustsProfile = currentUser.trusts?.includes(profileUser.id) ?? false;
	const profileTrustsViewer = profileUser.trusts?.includes(currentUser.id) ?? false;

	const publicItems = allItems.filter((item) => !item.trusteesOnly);
	const trustedItemsAll = allItems.filter((item) => item.trusteesOnly);
	// Only reveal trusted items if the viewer is in the owner's trust circle
	const trustedItems = profileTrustsViewer ? trustedItemsAll : null;

	return {
		profileUser,
		publicItems,
		trustedItems,
		isOwnProfile,
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
