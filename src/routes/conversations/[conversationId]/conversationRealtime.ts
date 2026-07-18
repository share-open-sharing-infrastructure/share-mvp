import type PocketBase from 'pocketbase';
import { subscribeRealtime } from '$lib/client-pb';
import type { Conversation, Message } from '$lib/types/models';

/**
 * Keep a single open conversation in sync with realtime `conversations` events.
 *
 * Encapsulates the wire-format handling that would otherwise live in the
 * conversation page: an `update` event carries only the changed conversation
 * record (lending status, counterfactual, and the message-id list), so the newly
 * appended message has to be refetched before it can be rendered.
 *
 * State is read/written through the `accessors` closures so the caller keeps
 * ownership of the reactive state — this helper never touches Svelte runes.
 * Built on {@link subscribeRealtime}, so it inherits retry-on-connect-failure and
 * recovery after a network drop / mobile background-freeze (issue #435).
 *
 * @param pb             Shared client PocketBase instance (from `getClientPB()`).
 * @param conversationId Record id of the conversation to subscribe to.
 * @param accessors      Read/write hooks for the caller's reactive state.
 * @param onReconnect    Optional callback run after the stream reconnects —
 *   messages sent while the stream was down are not replayed, so the caller
 *   should refetch (e.g. `invalidateAll()`). Fixes the "doesn't update for one
 *   party" symptom in #435.
 * @returns An unsubscribe function suitable for `$effect`/`onMount` cleanup.
 */
export function subscribeConversation(
	pb: PocketBase,
	conversationId: string,
	accessors: {
		getMessages: () => Message[];
		setMessages: (next: Message[]) => void;
		setLendingStatus: (s: Conversation['lendingStatus']) => void;
		setCounterfactual: (c: Conversation['counterfactual']) => void;
	},
	onReconnect?: () => void
): () => void {
	const { getMessages, setMessages, setLendingStatus, setCounterfactual } = accessors;

	return subscribeRealtime<Conversation>({
		collection: 'conversations',
		topic: conversationId,
		handler: async (event) => {
			if (event.action !== 'update') return;

			// Update lending status / counterfactual if they changed (empty string → undefined).
			if (event.record.lendingStatus !== undefined) {
				setLendingStatus(event.record.lendingStatus || undefined);
			}
			if (event.record.counterfactual !== undefined) {
				setCounterfactual(event.record.counterfactual || undefined);
			}

			// Extract the last message id from the updated conversation record.
			const messageIds = event.record.messages as unknown as string[] | undefined;
			const lastMessageId = messageIds?.[messageIds.length - 1];

			// Skip fetch if there's no new message or we already have it.
			if (!lastMessageId || getMessages().some((m) => m.id === lastMessageId)) return;

			// Get the last message's contents from PocketBase.
			try {
				const latestMessage = await pb.collection('messages').getOne<Message>(lastMessageId);
				// Deduplicate: a server reload via use:enhance may have already added this
				// message while the fetch was in flight.
				if (!getMessages().some((m) => m.id === latestMessage.id)) {
					setMessages([...getMessages(), latestMessage]);
				}
			} catch (error) {
				console.error('Failed to fetch last message record:', error);
			}
		},
		onReconnect,
	});
}
