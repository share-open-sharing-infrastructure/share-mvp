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

	// Whether the item owner trusts the logged-in viewer (Owner → Viewer direction).
	const ownerTrustsViewer = currentUserId ? ownerTrusts.includes(currentUserId) : false;

	// Find an in-progress conversation for this viewer + item so the CTA can link
	// to it instead of creating a duplicate. We exclude rejected/completed states
	// (borrower may legitimately re-request) and the empty string (conversations
	// created before the lending feature was added have no lendingStatus value).
	let existingConversation: { id: string; lendingStatus: string } | null = null;
	if (currentUserId && !isOwnItem) {
		try {
			const conv = await locals.pb.collection('conversations').getFirstListItem(
				`requester="${currentUserId}" && requestedItem="${item.id}" && lendingStatus!="rejected" && lendingStatus!="completed" && lendingStatus!=""`,
				{ sort: '-created', fields: 'id,lendingStatus' }
			);
			existingConversation = { id: conv.id, lendingStatus: conv.lendingStatus };
		} catch {
			// No matching conversation — leave null
		}
	}

	// Total items listed by this owner (all statuses).
	let ownerItemCount = 0;
	if (item.expand?.owner?.id) {
		try {
			const { totalItems } = await locals.pb
				.collection('items')
				.getList(1, 1, { filter: `owner = "${item.expand.owner.id}"` });
			ownerItemCount = totalItems;
		} catch {
			// silently fall back to 0
		}
	}

	// Determine whether the owner has a valid geolocation before stripping it.
	const ownerGeo = item.expand?.owner?.geolocation as { lon: number; lat: number } | undefined;
	const ownerHasLocation =
		!!ownerGeo && !(ownerGeo.lon === 0 && ownerGeo.lat === 0);

	// Strip fields from owner expand that must not reach the client.
	if (item.expand?.owner) {
		delete item.expand.owner.geolocation;
		delete item.expand.owner.trusts;
	}

	return {
		item,
		PB_IMG_URL: PUBLIC_PB_URL,
		currentUserId,
		isAuthenticated,
		isTrustRestricted,
		isOwnItem,
		viewerTrustsOwner,
		ownerTrustsViewer,
		ownerHasLocation,
		ownerItemCount,
		preferredTransportMode: locals.user?.preferredTransportMode ?? 'bicycle',
		existingConversation,
	};
}

export const actions = {
	toggleStatus: async ({ locals, params }) => {
		if (!locals.user) {
			redirect(303, `/auth/login?redirectTo=/items/${params.id}`);
		}

		let item: Item;
		try {
			item = await locals.pb.collection('items').getOne(params.id);
		} catch {
			return fail(404, { fail: true, message: texts.errors.itemNotFound });
		}

		if (item.owner !== locals.user.id) {
			return fail(403, { fail: true, message: texts.errors.noPermission });
		}

		const newStatus = item.status === 'available' ? 'unavailable' : 'available';
		try {
			await locals.pb.collection('items').update(params.id, { status: newStatus });
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			console.error(e?.message ?? err);
		}
	},

	startConversation: async ({ locals, request, params }) => {
		if (!locals.user) {
			redirect(303, `/auth/login?redirectTo=/items/${params.id}`);
		}

		// Fetch the item server-side so we never trust ownerId from form data.
		let itemRecord: Item;
		try {
			itemRecord = await locals.pb.collection('items').getOne(params.id);
		} catch {
			return fail(404, { fail: true, message: texts.errors.itemNotFound });
		}

		// Consume form data (itemId kept for the conversation filter; ownerId ignored).
		const formData = await request.formData();
		const itemId = formData.get('itemId') as string;
		const requesterId = locals.user.id;
		const itemOwnerId = itemRecord.owner;

		// Check if a non-rejected/completed conversation already exists for this requester+item.
		let targetConversationId = '';
		let existingConversations;
		try {
			existingConversations = await locals.pb.collection('conversations').getFullList({
				filter: `requester = "${requesterId}" && requestedItem = "${itemId}" && lendingStatus!="rejected" && lendingStatus!="completed" && lendingStatus!=""`,
				sort: '-created',
			});
		} catch {
			existingConversations = [];
		}

		if (existingConversations.length > 0) {
			targetConversationId = existingConversations[0].id;
		} else {
			let conversation;
			try {
				conversation = await locals.pb.collection('conversations').create({
					requester: requesterId,
					itemOwner: itemOwnerId,
					requestedItem: itemId,
					lendingStatus: 'pending',
					readByRequester: true,
					readByOwner: false,
				});
			} catch (err) {
				const e = err as Partial<ClientResponseError>;
				return fail(e.status ?? 500, {
					fail: true,
					message: e.data?.message ?? texts.errors.failedToCreateConversation,
				});
			}

			targetConversationId = conversation.id;

			const requesterName = locals.user.username ?? locals.user.name ?? texts.pages.itemDetail.unknownRequester;
			const itemName = itemRecord.name ?? texts.pages.itemDetail.unknownItem;
			const notificationBody = texts.notifications.newRequest(requesterName, itemName);
			const conversationUrl = `/conversations/${targetConversationId}`;

			await createNotification(locals.pb, itemOwnerId, locals.user.id, 'new_request', targetConversationId, notificationBody);
			await sendPushToUser(locals.pb, itemOwnerId, texts.notifications.pushTitle, notificationBody, conversationUrl);
		}

		redirect(303, `/conversations/${targetConversationId}`);
	},
};
