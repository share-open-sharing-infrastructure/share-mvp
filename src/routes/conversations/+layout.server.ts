import type { Conversation } from '$lib/types/models.js';
import { error } from '@sveltejs/kit';
import { PUBLIC_PB_URL } from '$env/static/public';
import { conversationFieldsWithSafePartners } from '$lib/server/conversations.js';

export async function load({ locals }) {
	const currentUserId = locals.user.id;
	let allConversations: Conversation[] = [];

	try {
		allConversations = await locals.pb.collection('conversations').getFullList({
			// The `conversations` collection's listRule already restricts results to
			// `itemOwner`/`requester` matches (see the backend migration), so this filter is
			// redundant against a well-behaved API rule — it's kept anyway as deliberate
			// defense-in-depth: it documents the same constraint explicitly here, so a future
			// change that accidentally loosens the API rule fails safe (an empty/narrower
			// result set) instead of silently leaking other users' conversations.
			filter: locals.pb.filter('requester = {:userId} || itemOwner = {:userId}', {
				userId: currentUserId,
			}),
			expand: 'requester, itemOwner, requestedItem',
			// requester/itemOwner are restricted to a safe field subset (never the full
			// User, in particular never `email`) — see conversationFieldsWithSafePartners().
			fields: conversationFieldsWithSafePartners('*,expand.requestedItem.*'),
			sort: '-lastMessageAt,-updated', // sort by latest message, fall back to updated for conversations without messages yet
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
