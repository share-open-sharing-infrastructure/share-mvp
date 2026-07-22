import type PocketBase from 'pocketbase';
import { OPEN_LENDING_STATES, lendingStatusFilter } from '$lib/lending';
import { deleteConversation } from './conversations';

export type DeleteItemResult =
	| { status: 'deleted' }
	| { status: 'not_found' }
	| { status: 'not_owner' }
	| { status: 'has_open_conversations'; conversationIds: string[] };

/**
 * Deletes an item and all related closed conversations (with their notifications).
 * Refuses if any conversation is still open (OPEN_LENDING_STATES:
 * pending/accepted/active/return_requested).
 * Checks ownership before acting.
 */
export async function deleteItem(
	pb: PocketBase,
	itemId: string,
	ownerUserId: string
): Promise<DeleteItemResult> {
	let item;
	try {
		item = await pb.collection('items').getOne(itemId);
	} catch {
		return { status: 'not_found' };
	}

	if (item.owner !== ownerUserId) return { status: 'not_owner' };

	const open = await pb.collection('conversations').getFullList({
		filter: pb.filter(
			'requestedItem = {:itemId} && ' + lendingStatusFilter(OPEN_LENDING_STATES),
			{ itemId }
		),
	});

	if (open.length > 0) {
		return { status: 'has_open_conversations', conversationIds: open.map((c) => c.id) };
	}

	const conversations = await pb
		.collection('conversations')
		.getFullList({ filter: pb.filter('requestedItem = {:itemId}', { itemId }) });

	for (const conversation of conversations) {
		await deleteConversation(pb, conversation.id);
	}

	await pb.collection('items').delete(itemId);
	return { status: 'deleted' };
}

/**
 * Deletes multiple items by calling deleteItem() for each.
 * Skips items not owned by ownerUserId or not found.
 * Collects items blocked by open conversations separately.
 */
export async function deleteMultipleItems(
	pb: PocketBase,
	itemIds: string[],
	ownerUserId: string
): Promise<{ deleted: number; blocked: Array<{ itemId: string; conversationIds: string[] }> }> {
	let deleted = 0;
	const blocked: Array<{ itemId: string; conversationIds: string[] }> = [];

	for (const itemId of itemIds) {
		try {
			const result = await deleteItem(pb, itemId, ownerUserId);
			if (result.status === 'deleted') {
				deleted++;
			} else if (result.status === 'has_open_conversations') {
				blocked.push({ itemId, conversationIds: result.conversationIds });
			}
		} catch (err: unknown) {
			console.error('Failed to delete item', itemId, err instanceof Error ? err.message : err);
		}
	}

	return { deleted, blocked };
}

/**
 * Updates the status of an item after verifying ownership.
 * Returns false if the item is not found or the caller is not the owner.
 */
export async function setItemStatus(
	pb: PocketBase,
	itemId: string,
	ownerUserId: string,
	newStatus: 'available' | 'unavailable'
): Promise<boolean> {
	let item;
	try {
		item = await pb.collection('items').getOne(itemId);
	} catch {
		return false;
	}

	if (item.owner !== ownerUserId) return false;

	await pb.collection('items').update(itemId, { status: newStatus });
	return true;
}

export type ToggleItemStatusResult =
	| { status: 'ok'; newStatus: 'available' | 'unavailable' }
	| { status: 'not_found' }
	| { status: 'not_owner' };

/**
 * Flips an item's status between `available`/`unavailable` after verifying ownership.
 *
 * Unlike the item-agnostic {@link setItemStatus}, this reads the current status itself to
 * compute the flip, and — importantly — lets a failed update `throw` instead of swallowing
 * it: the previous route-local copy of this logic caught and only `console.error`'d an update
 * failure, so the form action reported success (no `fail()`) even when the write didn't
 * happen. Callers are expected to catch and translate a thrown error into `fail()`.
 */
export async function toggleItemStatus(
	pb: PocketBase,
	itemId: string,
	ownerUserId: string
): Promise<ToggleItemStatusResult> {
	let item;
	try {
		item = await pb.collection('items').getOne(itemId);
	} catch {
		return { status: 'not_found' };
	}

	if (item.owner !== ownerUserId) return { status: 'not_owner' };

	const newStatus = item.status === 'available' ? 'unavailable' : 'available';
	await pb.collection('items').update(itemId, { status: newStatus });
	return { status: 'ok', newStatus };
}
