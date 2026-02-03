import { PUBLIC_PB_URL } from '../../hooks.server';
import type { Item } from '$lib/types/models';
import { filterTrustedItems } from '$lib/server/itemFilters';
import type { ClientResponseError } from 'pocketbase';
import { fail, redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	// Fetch all items from PocketBase
	const items: Item[] = await locals.pb.collection('items').getFullList({
		expand: 'owner', // expand the relation to the 'owner' (user) collection
		sort: '-updated', // sort by update date descending
		filter: locals.user ? `owner != "${locals.user.id}"` : undefined // exclude user's own items from search results (if logged in)
	});

	// Filter out items which the current user is not trusted with
	const filteredItems = filterTrustedItems(
		items,
		locals.user ? locals.user.id : null,
		locals.pb.authStore.isValid
	);

	// Extract unique places and names for filtering options
	const uniquePlaces = Array.from(new Set(filteredItems.map((item) => item.place))); // deduplicates places by creating a Set

	// Return data to the page
	return {
		items: filteredItems,
		PB_IMG_URL: PUBLIC_PB_URL,
		uniquePlaces: uniquePlaces,
		userId: locals.user ? locals.user.id : null
	};
}

export const actions = {
    startConversation: async ({ locals, request }) => {
		const formData = await request.formData();

		// get the message data from the form
	 	const requesterId = locals?.user?.id;
		const itemOwnerId = formData.get('ownerId');
		const itemId = formData.get("itemId");

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
				message: e.data?.message ?? 'Failed to create conversation.'
			});
		}

        // Conversation created
        if (conversation){
            const conversationId: string = conversation.id;
            redirect(303, `/conversations/${conversationId}`)
        }
	}
    
};
