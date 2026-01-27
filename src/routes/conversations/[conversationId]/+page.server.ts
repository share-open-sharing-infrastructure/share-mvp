import { error, fail, redirect } from "@sveltejs/kit";
import type { ClientResponseError } from "pocketbase";
import { PUBLIC_PB_URL } from '$env/static/public';
import type { Conversation, Message } from "$lib/types/models.js";

export async function load({ params, locals }) {
    const conversationId: string = params.conversationId;
    let conversationRecord;
    try {
        conversationRecord = await locals.pb
            .collection('conversations')
            .getOne(conversationId, { expand: 'requester, itemOwner, requestedItem, messages' });
    } catch (err) {
        console.error('Failed to load conversation', err);
        error(500, 'Unable to load conversation.');
    }

    let conversation: Conversation = {
        id: conversationRecord.id,
        requester: conversationRecord.expand.requester,
        itemOwner: conversationRecord.expand.itemOwner,
        requestedItem: conversationRecord.expand.requestedItem,
        messages: conversationRecord.expand.messages,
        readByRequester: conversationRecord.readByRequester,
        readByOwner: conversationRecord.readByOwner,
        created: conversationRecord.created,
        updated: conversationRecord.updated
    };

    return {
        conversation,
        PB_URL: PUBLIC_PB_URL
    };
}

export const actions = {
    sendMessage: async ({ locals, request, params }) => {
        const formData = await request.formData();

        const messageContent = formData.get('messageContent');
        const fromUserId = locals.user.id;
        const toUserId = formData.get('chatPartnerId') as string;

        const messageData = {
            messageContent: messageContent,
            from: fromUserId,
            to: toUserId
        };

        let createdMessage: Message;
        // try to send message to database
        try {
            createdMessage = await locals.pb.collection('messages').create(messageData);
        } catch (err) {
            const e = err as Partial<ClientResponseError>;
            return fail(e.status ?? 500, {
                fail: true,
                message: e.data?.message ?? 'Failed to send message.'
            });
        }

        // Append created messages to conversation
        if (createdMessage) {
            const conversationId: string = params.conversationId;
            const conversationRecord = await locals.pb.collection('conversations').getOne(conversationId);
            const updatedMessages = conversationRecord.messages ? [...conversationRecord.messages, createdMessage.id] : [createdMessage.id];

            try {
                await locals.pb.collection('conversations').update(conversationId, { messages: updatedMessages });
            } catch (err) {
                const e = err as Partial<ClientResponseError>;
                return fail(e.status ?? 500, {
                    fail: true,
                    message: e.data?.message ?? 'Failed to send message.'
                });
            }
        }

    },
    deleteConversation: async ({ locals, request }) => {
        const formData = await request.formData();
        const conversationId = formData.get('conversationId') as string;

        try {
            await locals.pb.collection('conversations').delete(conversationId);
        } catch (err) {
            const e = err as Partial<ClientResponseError>;
            return fail(e.status ?? 500, {
                fail: true,
                message: e.data?.message ?? 'Failed to delete conversation.'
            });
        }
        redirect(303, '/conversations');
    }

};