import type { Conversation } from '$lib/types/models';
import { OPEN_LENDING_STATES, isLendingStatusIn } from '$lib/lending';

/** `null` = no role filter selected, show both lending and borrowing conversations. */
export type ConversationRoleFilter = 'lending' | 'borrowing' | null;

/** Is the current user the item owner (lending) side of this conversation? */
export function isLending(c: Pick<Conversation, 'itemOwner'>, currentUserId: string): boolean {
	return c.itemOwner === currentUserId;
}

/**
 * Plain chats without a lending status count as active; terminal states
 * (rejected/aborted/completed) do not.
 */
export function isConversationActive(c: Pick<Conversation, 'lendingStatus'>): boolean {
	return !c.lendingStatus || isLendingStatusIn(OPEN_LENDING_STATES, c.lendingStatus);
}

/** Does `c` match the selected lending/borrowing tab (or pass through when none is selected)? */
export function matchesRole(
	c: Pick<Conversation, 'itemOwner'>,
	currentUserId: string,
	filter: ConversationRoleFilter
): boolean {
	return filter === null || (filter === 'lending') === isLending(c, currentUserId);
}

/** Does `c` pass the "only active conversations" checkbox? */
export function matchesActive(c: Pick<Conversation, 'lendingStatus'>, showOnlyActive: boolean): boolean {
	return !showOnlyActive || isConversationActive(c);
}

export type EmptyReason = 'active' | 'lending' | 'borrowing' | 'none';

/**
 * Which empty-state message the sidebar should show. `hasAnyMatchingRoleFilter` is whether
 * any conversation matches the selected lending/borrowing tab BEFORE the "only active"
 * checkbox is applied — so a tab that has conversations, all hidden by that checkbox, still
 * reports 'active' (matching the checkbox's own empty-state copy) rather than falsely
 * claiming there are no conversations of that type at all.
 */
export function emptyReason(hasAnyMatchingRoleFilter: boolean, activeFilter: ConversationRoleFilter): EmptyReason {
	if (hasAnyMatchingRoleFilter) return 'active';
	if (activeFilter === 'lending') return 'lending';
	if (activeFilter === 'borrowing') return 'borrowing';
	return 'none';
}
