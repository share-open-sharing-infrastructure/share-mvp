import { error, fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';

export async function load({ locals, params, parent }) {

	// Get chat message data from parent layout
	const parentData = await parent();
	const allMessages = parentData.allMessages;

	// Get all messages only for the currently selected target user
    let	currentChatPartnerId: string = params.userId;
	let userRecord;

	try {
		userRecord = await locals.pb
			.collection('users')
			.getOne(currentChatPartnerId, { fields: 'id,username,email' });
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		console.error('Failed to load chats', err);
		error(e.status ?? 500, 'Unable to load chats.');
	}

	let	currentMessages = [];
	if (locals.pb.authStore.record.id !== currentChatPartnerId) {
		currentMessages = allMessages.filter(msg => msg.from === currentChatPartnerId || msg.to === currentChatPartnerId);
		//sort messages oldest to newest to display newer messages at the bottom
		currentMessages.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
	} else {
		// If the user is trying to chat with themselves, redirect to a safe default (first chat partner)
		// TODO: Find a more elegant way to do this maybe
		let firstChatPartnerId: string;
		allMessages[0].from === locals.pb.authStore.record.id
			? firstChatPartnerId = allMessages[0].to
			: firstChatPartnerId = allMessages[0].from;

		redirect(308, `/chat/${firstChatPartnerId}`);
	}

	return {
		currentMessages,
		currentChatPartner: userRecord
	};
}

export const actions = {
    sendMessage: async ({ locals, request, params }) => {
        
		// get the message data from the form
		const formData = await request.formData();
		const messageContent = formData.get('messageContent');
		const fromUserId = locals.pb.authStore.record.id;
		const toUserId = params.userId;

		// try to send message to database
		try {
			const data = {
				"messageContent": messageContent,
				"from": fromUserId,
				"to": toUserId
			};
			const record = await locals.pb.collection('messages').create(data);
		} catch (err) {
            const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, {
				fail: true,
				message: e.data?.message ?? 'Failed to send message.'
			});
		}
    }
};