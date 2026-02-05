import type { Conversation } from '$lib/types/models.js';
import { error } from '@sveltejs/kit';
import { PUBLIC_PB_URL } from '$env/static/public';

export async function load({ locals }) {
	const currentUserId = locals.user.id;
	let allConversations: Conversation[] = [];

	try {
		allConversations = await locals.pb.collection('conversations').getFullList({
			filter: `requester = "${currentUserId}" || itemOwner = "${currentUserId}"`, // TODO: Check if this even needs the filter given PocketBase should only return records the user has access to based on API rules
			expand: 'requester, itemOwner, requestedItem',
			sort: '-updated', // sort by newest first
		});
	} catch (err) {
		console.error('Failed to load conversation', err);
		error(500, 'Failed to load conversations');
	}

	// return data to the page
	return {
		conversations: allConversations,
		PB_IMG_URL: PUBLIC_PB_URL,
	};
}
