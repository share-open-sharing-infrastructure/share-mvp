import type PocketBase from 'pocketbase';
import { subscribeRealtime } from '$lib/realtime';
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
 * @param accessors      Read/write hooks for the caller's reactive state, plus `onReadState`:
 *   a notification (not a state mirror) carrying the record's `readByRequester`/`readByOwner`
 *   on every update event, so the caller can re-assert read-state while the thread is open —
 *   an incoming message flips the recipient's flag back to `false` server-side (issue #412).
 * @param onReconnect    Optional callback run after the stream reconnects —
 *   messages sent while the stream was down are not replayed, so the caller
 *   should refetch (e.g. `invalidateAll()`). Fixes the "doesn't update for one
 *   party" symptom in #435.
 * @param expectsHeartbeat  Set when the subscribing page pushes a periodic update
 *   that is echoed back over SSE (the chat-detail presence heartbeat), so the
 *   client-pb watchdog may treat a longer silence as a frozen stream and reconnect
 *   (#528). Forwarded to {@link subscribeRealtime}.
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
		onReadState: (flags: { readByRequester: boolean; readByOwner: boolean }) => void;
	},
	onReconnect?: () => void,
	expectsHeartbeat?: boolean
): () => void {
	const { getMessages, setMessages, setLendingStatus, setCounterfactual, onReadState } = accessors;

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

			// Report the record's read flags on every update — the caller re-asserts read-state
			// from them while the thread is open (issue #412; see `onReadState` above). Both
			// flags must be real booleans: a record that omits them must never be read as
			// "unread", or every event (incl. the 15 s heartbeat echo) would trigger a re-mark.
			if (
				typeof event.record.readByRequester === 'boolean' &&
				typeof event.record.readByOwner === 'boolean'
			) {
				onReadState({
					readByRequester: event.record.readByRequester,
					readByOwner: event.record.readByOwner,
				});
			}

			// A coalesced/batched SSE event can carry more than one new message at once
			// (e.g. two messages sent in quick succession before the client processes the
			// first event) — fetch every id not already held locally, not just the last one,
			// or earlier messages in the same batch are silently dropped until the next full
			// reload.
			const messageIds = event.record.messages as unknown as string[] | undefined;
			if (!messageIds || messageIds.length === 0) return;

			const existingIds = new Set(getMessages().map((m) => m.id));
			const newIds = messageIds.filter((id) => !existingIds.has(id));

			// Skip fetch if there's nothing new.
			if (newIds.length === 0) return;

			// Get the new messages' contents from PocketBase, in their conversation order.
			try {
				const newMessages = await Promise.all(newIds.map((id) => pb.collection('messages').getOne<Message>(id)));
				// Deduplicate: a server reload via use:enhance may have already added some of
				// these messages while the fetch was in flight.
				const stillMissing = newMessages.filter((m) => !getMessages().some((existing) => existing.id === m.id));
				if (stillMissing.length > 0) {
					setMessages([...getMessages(), ...stillMissing]);
				}
			} catch (error) {
				console.error('Failed to fetch new message records:', error);
			}
		},
		onReconnect,
		expectsHeartbeat,
	});
}
