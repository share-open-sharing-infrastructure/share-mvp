import type PocketBase from 'pocketbase';
import { subscribeRealtime } from '$lib/client-pb';
import type { Conversation } from '$lib/types/models';

/**
 * Keep a local conversation list in sync with realtime `conversations` events.
 *
 * Encapsulates the wire-format handling that would otherwise live in the
 * sidebar layout: realtime `update` events only carry the changed record, and
 * `create` events arrive without expanded relations, so a full record has to be
 * refetched before it can be rendered in the list.
 *
 * The list is read/written through `getList`/`setList` so the caller keeps
 * ownership of the reactive `$state` — this helper never touches Svelte runes.
 * Built on {@link subscribeRealtime}, so it inherits retry-on-connect-failure and
 * recovery after a network drop / mobile background-freeze (issue #435).
 *
 * @param pb        Shared client PocketBase instance (from `getClientPB()`).
 * @param getList   Returns the current conversation list.
 * @param setList   Replaces the conversation list with a new array.
 * @param onReconnect Optional callback run after the stream reconnects — list
 *   changes that happened while the stream was down are not replayed, so the
 *   caller should refetch (e.g. `invalidateAll()`).
 * @returns An unsubscribe function suitable for `$effect`/`onMount` cleanup.
 */
export function subscribeConversationList(
	pb: PocketBase,
	getList: () => Conversation[],
	setList: (next: Conversation[]) => void,
	onReconnect?: () => void
): () => void {
	return subscribeRealtime<Conversation>({
		collection: 'conversations',
		topic: '*',
		handler: async (e) => {
			if (e.action === 'update') {
				setList(
					getList().map((c) =>
						c.id === e.record.id
							? {
									...c,
									readByOwner: e.record.readByOwner,
									readByRequester: e.record.readByRequester,
								}
							: c
					)
				);
			} else if (e.action === 'create') {
				if (getList().some((c) => c.id === e.record.id)) return;
				try {
					// Subscription events don't include expanded relations — fetch the full record.
					const full = await pb
						.collection('conversations')
						.getOne<Conversation>(e.record.id, {
							expand: 'requester,itemOwner,requestedItem',
						});
					setList([...getList(), full]);
				} catch {
					// Record may have been deleted before we could fetch it — ignore silently.
				}
			}
		},
		onReconnect,
	});
}
