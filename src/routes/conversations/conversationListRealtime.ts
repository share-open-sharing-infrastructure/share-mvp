import type PocketBase from 'pocketbase';
import { subscribeRealtime } from '$lib/client-pb';
import { conversationFieldsWithSafePartners } from '$lib/conversationPartnerFields';
import type { Conversation } from '$lib/types/models';

/**
 * Mirrors the server-side list sort (`sort: '-lastMessageAt,-updated'` in
 * `+layout.server.ts`'s `load()`): primary key `lastMessageAt` descending, ties broken by
 * `updated` descending. Both are ISO datetime strings, so plain string comparison sorts them
 * correctly; a conversation with no messages yet has `lastMessageAt === ''`, which sorts
 * after every real timestamp (empty string is lexicographically smallest).
 */
function compareConversations(a: Conversation, b: Conversation): number {
	const aLast = a.lastMessageAt ?? '';
	const bLast = b.lastMessageAt ?? '';
	if (aLast !== bLast) return aLast > bLast ? -1 : 1;
	if (a.updated !== b.updated) return a.updated > b.updated ? -1 : 1;
	return 0;
}

/** Inserts `item` into `list` at the position `compareConversations` says it belongs. */
function insertSorted(list: Conversation[], item: Conversation): Conversation[] {
	const idx = list.findIndex((c) => compareConversations(item, c) < 0);
	if (idx === -1) return [...list, item];
	return [...list.slice(0, idx), item, ...list.slice(idx)];
}

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
					getList()
						.map((c) =>
							c.id === e.record.id
								? {
										...c,
										readByOwner: e.record.readByOwner,
										readByRequester: e.record.readByRequester,
										lastMessageAt: e.record.lastMessageAt,
										lendingStatus: e.record.lendingStatus,
									}
								: c
						)
						.sort(compareConversations)
				);
			} else if (e.action === 'create') {
				if (getList().some((c) => c.id === e.record.id)) return;
				try {
					// Subscription events don't include expanded relations — fetch the full record.
					// This runs client-side, so the `requester`/`itemOwner` expands must be restricted
					// to the safe partner fields (never the full `User`, in particular never `email`) —
					// same protection as the server-side `load()`s in this route.
					const full = await pb
						.collection('conversations')
						.getOne<Conversation>(e.record.id, {
							expand: 'requester,itemOwner,requestedItem',
							fields: conversationFieldsWithSafePartners('*,expand.requestedItem.*'),
						});
					setList(insertSorted(getList(), full));
				} catch {
					// Record may have been deleted before we could fetch it — ignore silently.
				}
			} else if (e.action === 'delete') {
				// Otherwise a deleted conversation stays in the sidebar and 404s on click.
				setList(getList().filter((c) => c.id !== e.record.id));
			}
		},
		onReconnect,
	});
}
