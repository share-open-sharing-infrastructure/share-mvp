import type { Conversation, ConversationPartner, Item, Message } from '$lib/types/models';

/**
 * Flattened view-model the detail page (and its header) render from — the honest wire
 * `Conversation` record (ids + optional `expand`) mapped into the fully-resolved shape the
 * UI actually needs, with `requestedItem` explicitly typed as nullable: an item can go
 * dangling (deleted/inaccessible) while its conversation persists, and every consumer of
 * this shape must handle that case instead of crashing on `.name`/`.image`/`.status`
 * (the list view already guards this via `expand?.requestedItem ?? null`; this mapper
 * brings the detail page and `ConversationHeader` up to the same standard).
 */
export interface ConversationDetail {
	id: string;
	/** Restricted to a safe field subset (never the full `User`, in particular never `email`) — see `$lib/server/conversations.ts`'s `conversationFieldsWithSafePartners()`. */
	requester: ConversationPartner;
	/** Same restriction as `requester` above. */
	itemOwner: ConversationPartner;
	/** `null` when the item is missing/dangling — render an "item unavailable" fallback. */
	requestedItem: Item | null;
	messages: Message[];
	readByRequester: boolean;
	readByOwner: boolean;
	lendingStatus: Conversation['lendingStatus'];
	counterfactual: Conversation['counterfactual'];
	created: string;
	updated: string;
}

/**
 * Maps a `conversations` record (fetched with
 * `expand: 'requester,itemOwner,requestedItem,messages'`) to the flattened
 * {@link ConversationDetail} view-model.
 *
 * `requester`/`itemOwner` are required relations that are never expected to go dangling
 * (accounts are anonymized in place on deletion, never removed) — if the expand is somehow
 * missing, this throws rather than silently rendering `undefined` as a user.
 */
export function toConversationDetail(record: Conversation): ConversationDetail {
	const expand = record.expand ?? {};
	if (!expand.requester || !expand.itemOwner) {
		throw new Error('toConversationDetail: conversation record is missing requester/itemOwner expand');
	}

	return {
		id: record.id,
		requester: expand.requester,
		itemOwner: expand.itemOwner,
		requestedItem: expand.requestedItem ?? null,
		messages: expand.messages ?? [],
		readByRequester: record.readByRequester,
		readByOwner: record.readByOwner,
		lendingStatus: record.lendingStatus,
		counterfactual: record.counterfactual,
		created: record.created,
		updated: record.updated,
	};
}
