import { redirect } from '@sveltejs/kit';

export const load = (async ({ locals }) => {
    
    // check if current user is authenticated, otherwise redirect to login
    if (!locals.pb.authStore.record) {
            return redirect(303, '/login')
    }

    // Get list of all users that the current user has chatted with
    const currentUserId = locals.pb.authStore.record.id;
    const allMessages = await locals.pb.collection('messages').getFullList({
         filter: `from = "${currentUserId}" || to = "${currentUserId}"`,
    });

    const uniqueChatPartners = new Map<string, {id: string; username: string, email: string}>();
    for (const message of allMessages) { // Find all unique chat partners based on messages
        const chatPartnerId = message.from === currentUserId ? message.to : message.from;
        if (!uniqueChatPartners.has(chatPartnerId)) {
            const userRecord = await locals.pb.collection('users').getOne(chatPartnerId, { fields: 'id,username,email' });
            uniqueChatPartners.set(chatPartnerId, {
                id: userRecord.id,
                username: userRecord.username,
                email: userRecord.email
            });
        }
    }

    // return data to the page
    return {
        chatPartners: Array.from(uniqueChatPartners.values()),
        allMessages,
        currentUserId
    };
});

