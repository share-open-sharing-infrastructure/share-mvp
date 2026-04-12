import { PUBLIC_PB_URL } from '../../../hooks.server';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Item } from '$lib/types/models';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import { createNotification, sendPushToUser } from '$lib/server/notifications.js';

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
	const isOwnItem = currentUserId === item.expand?.owner?.id;
	const viewerTrustsOwner = locals.user?.trusts?.includes(item.expand?.owner?.id) ?? false;

	return {
		item,
		PB_IMG_URL: PUBLIC_PB_URL,
		currentUserId,
		isAuthenticated,
		isTrustRestricted,
		isOwnItem,
		viewerTrustsOwner,
	};
}

export const actions = {
	toggleStatus: async ({ locals, request, params }) => {
		if (!locals.user) {
			redirect(303, `/auth/login?redirectTo=/items/${params.id}`);
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let item: any;
		try {
			item = await locals.pb.collection('items').getOne(params.id);
		} catch {
			return fail(404, { fail: true, message: 'Gegenstand nicht gefunden.' });
		}

		if (item.owner !== locals.user.id) return fail(403, { fail: true, message: 'Keine Berechtigung.' });

		const newStatus = item.status === 'available' ? 'unavailable' : 'available';
		try {
			await locals.pb.collection('items').update(params.id, { status: newStatus });
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: Error | any) {
			console.error(err?.message ?? err);
		}
	},

	startConversation: async ({ locals, request, params }) => {
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

			// Notify the item owner about the new request
			const itemRecord = await locals.pb.collection('items').getOne(itemId as string).catch(() => null);
			const requesterName = locals.user.username ?? locals.user.name ?? 'Jemand';
			const itemName = itemRecord?.name ?? 'einem Gegenstand';
			const notificationBody = texts.notifications.newRequest(requesterName, itemName);
			const conversationUrl = `/conversations/${conversationId}`;

			await createNotification(locals.pb, itemOwnerId as string, locals.user.id as string, 'new_request', conversationId, notificationBody);
			await sendPushToUser(locals.pb, itemOwnerId as string, texts.notifications.pushTitle, notificationBody, conversationUrl);

			redirect(303, `/conversations/${conversationId}`);
		}
	},
};
