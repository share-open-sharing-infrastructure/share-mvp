import { PUBLIC_PB_URL } from '../../../hooks.server';
import { error, fail, redirect } from '@sveltejs/kit';
import type { ItemPublic } from '$lib/types/models';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import { createNotification, sendPushToUser } from '$lib/server/notifications.js';
import { getActiveTerms, hasAcceptedActiveTerms } from '$lib/server/lendingTerms';

export async function load({ params, locals }) {
	let item: ItemPublic;
	try {
		item = await locals.pb.collection('items_public').getOne(params.id, {});
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		error(e.status === 404 ? 404 : 500, 'Item not found');
	}

	const currentUserId = locals.user?.id ?? null;
	const isAuthenticated = locals.pb.authStore.isValid;
	const ownerTrusts: string[] = item.trusts ?? [];
	const isTrustRestricted =
		item.trusteesOnly && isAuthenticated && !ownerTrusts.includes(currentUserId);
	const isOwnItem = currentUserId === item.userId;
	const viewerTrustsOwner = locals.user?.trusts?.includes(item.userId) ?? false;

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

	// Does this owner publish lending terms, and if so has the viewer accepted them?
	// We only gate the request flow on terms when the viewer is logged in and not the owner.
	let requiresTermsAcceptance = false;
	if (currentUserId && !isOwnItem) {
		const ownerId = item.userId;
		const activeTerms = await getActiveTerms(locals.pb, ownerId);
		if (activeTerms) {
			const accepted = await hasAcceptedActiveTerms(locals.pb, currentUserId, ownerId);
			requiresTermsAcceptance = !accepted;
		}
	}

	// Total items listed by this owner (all statuses).
	let ownerItemCount = 0;
	if (item.userId) {
		try {
			const { totalItems } = await locals.pb
				.collection('items_public')
				.getList(1, 1, {
					filter: locals.pb.filter('userId = {:userId}', { userId: item.userId }),
				});
			ownerItemCount = totalItems;
		} catch {
			// silently fall back to 0
		}
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
		ownerItemCount,
		preferredTransportMode: locals.user?.preferredTransportMode ?? 'bicycle',
		existingConversation,
		requiresTermsAcceptance,
		ownerHasLocation: !!item.ownerHasLocation,
	};
}

export const actions = {
	toggleStatus: async ({ locals, params }) => {
		if (!locals.user) {
			redirect(303, `/auth/login?redirectTo=/items/${params.id}`);
		}

		let item: ItemPublic;
		try {
			item = await locals.pb.collection('items_public').getOne(params.id);
		} catch {
			return fail(404, { fail: true, message: texts.errors.itemNotFound });
		}

		if (item.userId !== locals.user.id) {
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
		let itemRecord: ItemPublic;
		try {
			itemRecord = await locals.pb.collection('items_public').getOne(params.id);
		} catch {
			return fail(404, { fail: true, message: texts.errors.itemNotFound });
		}

		// If the item's owner publishes lending terms and the user has not accepted
		// the active version, divert them through the terms acceptance flow. This
		// guards against POSTing directly to ?/startConversation past the CTA UI.
		const termsOk = await hasAcceptedActiveTerms(
			locals.pb,
			locals.user.id,
			itemRecord.userId
		);
		if (!termsOk) {
			redirect(303, `/items/${params.id}/terms`);
		}

		// Consume form data (itemId kept for the conversation filter; ownerId ignored).
		const formData = await request.formData();
		const itemId = formData.get('itemId') as string;
		const requesterId = locals.user.id;
		const itemOwnerId = itemRecord.userId;

		// Check if a non-rejected/completed conversation already exists for this requester+item.
		let targetConversationId = '';
		let existingConversations;
		try {
			existingConversations = await locals.pb.collection('conversations').getFullList({
				filter: locals.pb.filter(
					'requester = {:requesterId} && requestedItem = {:itemId} && lendingStatus!="rejected" && lendingStatus!="completed" && lendingStatus!=""',
					{ requesterId, itemId }
				),
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
