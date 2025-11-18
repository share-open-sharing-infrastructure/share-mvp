export async function load({ params, parent }) {

	// Get chat message data from parent layout
	const parentData = await parent();
	const allMessages = parentData.allMessages;

	// Get all messages only for the currently selected target user
    let	currentChatPartnerId: string = params.userId;
    const currentMessages = allMessages.filter(msg => msg.from === currentChatPartnerId || msg.to === currentChatPartnerId);

	return {
		currentMessages,
		currentChatPartnerId
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
		} catch (error) {
			console.error("Error sending message:", error);
		}        
    }
};