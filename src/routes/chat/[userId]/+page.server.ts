import { redirect } from "@sveltejs/kit";

let currentUserId: string;
let	currentChatPartnerId: string;

export async function load({ locals, params, parent }) {
	currentUserId = locals.pb.authStore.record.id;

	// Get chat message data from parent layout
	const parentData = await parent();
	const allMessages = parentData.allMessages;

	// Get all messages only for the currently selected target user
    currentChatPartnerId = params.userId;
    const currentMessages = allMessages.filter(msg => msg.from === currentChatPartnerId || msg.to === currentChatPartnerId);

	return {
		currentMessages
	};
}

export const actions = {
    sendMessage: async ({ locals, request }) => {
        
		// get the message data from the form
		const formData = await request.formData();
		const messageContent = formData.get('messageContent');
		const fromUserId = currentUserId;
		const toUserId = currentChatPartnerId;

		// try to send message to database
		try {
			const data = {
				"messageContent": messageContent,
				"from": fromUserId,
				"to": toUserId
			};
			const record = await locals.pb.collection('messages').create(data);
		} catch (error) {
			console.error("Error sending message:", error);
		}        
    }
};