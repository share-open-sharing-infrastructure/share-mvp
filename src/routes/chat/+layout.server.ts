import { error, redirect } from '@sveltejs/kit';

export const load = (async ({ locals }) => {
    // Get list of all users that the current user has chatted with
    // TODO: This feels inefficient, maybe there's a better way to directly pull chat partners without pulling all messages first, use expand?
    const currentUserId = locals.user.id;
    try {
        const allMessages = await locals.pb.collection('messages').getFullList({
            filter: `from = "${currentUserId}" || to = "${currentUserId}"`, // TODO: Check if this even needs the filter given PocketBase should only return records the user has access to based on API rules 
            sort: '-created' // sort by newest first
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
    } catch (err) {
        console.error('Failed to load chat layout', err);
        error(500, 'Failed to load chats');
    }
});

