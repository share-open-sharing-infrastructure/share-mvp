import {  redirect } from '@sveltejs/kit';

export const load = (async ({ locals }) => {
    if (!locals.pb.authStore.record) {
            return redirect(303, '/login')
    }
    
    // Get current user ID
    const currentUserId = locals.pb.authStore.record.id;

    // Get messages involving the current user
    const records = await locals.pb.collection('messages').getFullList({
         filter: `from = "${currentUserId}" || to = "${currentUserId}"`,
    });

    // Get IDs of users who have chatted with the current user
    const chatUserIds = new Set<string>();
    records.forEach((record) => {
        let chatUserId = "";
        if (record.from === currentUserId) {
            chatUserId = record.to;
        } else {
            chatUserId = record.from;
        }
        if(!chatUserIds.has(chatUserId)) {
            chatUserIds.add(chatUserId);
        }});

    // TODO: Might be more convenient to create a collection of users with messages embedded
    
    return {
        chatUserIds: Array.from(chatUserIds),
        records
    };
});
