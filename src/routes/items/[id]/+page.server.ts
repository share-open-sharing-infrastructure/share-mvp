import { PUBLIC_PB_URL } from '../../../hooks.server';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Item } from '$lib/types/models';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';

export async function load({ params, locals }) {
	let item: Item;
	try {
		item = await locals.pb.collection('items').getOne(params.id, {
			expand: 'owner',
		});
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		error(e.status === 404 ? 404 : 500, 'Item not found');
	}

	const currentUserId = locals.user?.id ?? null;
	const isAuthenticated = locals.pb.authStore.isValid;
	const ownerTrusts: string[] = item.expand?.owner?.trusts ?? [];
	const isTrustRestricted =
		item.trusteesOnly && isAuthenticated && !ownerTrusts.includes(currentUserId);

	return {
		item,
		PB_IMG_URL: PUBLIC_PB_URL,
		currentUserId,
		isAuthenticated,
		isTrustRestricted,
	};
}

export const actions = {
	startConversation: async ({ locals, request, params }) => {
		if (!locals.user) {
			redirect(303, `/auth/login?redirectTo=/items/${params.id}`);
		}

		const formData = await request.formData();
		const requesterId = locals.user.id;
		const itemOwnerId = formData.get('ownerId');
		const itemId = formData.get('itemId');

		const conversationData = {
			requester: requesterId,
			itemOwner: itemOwnerId,
			requestedItem: itemId,
			readByRequester: true,
			readByOwner: false,
		};

		let conversation;
		try {
			conversation = await locals.pb.collection('conversations').create(conversationData);
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, {
				fail: true,
				message: e.data?.message ?? texts.errors.failedToCreateConversation,
			});
		}

		if (conversation) {
			const conversationId: string = conversation.id;
			redirect(303, `/conversations/${conversationId}`);
		}
	},
};
