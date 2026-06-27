import type PocketBase from 'pocketbase';
import { deleteConversation } from '../../routes/conversations/[conversationId]/conversation.server';

/**
 * Deletes an item and all related conversations (with their notifications).
 * Checks ownership before deleting. Returns false if the item is not found or
 * the caller is not the owner; true on success.
 */
export async function deleteItem(
	pb: PocketBase,
	itemId: string,
	ownerUserId: string
): Promise<boolean> {
	let item;
	try {
		item = await pb.collection('items').getOne(itemId);
	} catch {
		return false;
	}

	if (item.owner !== ownerUserId) return false;

	const conversations = await pb
		.collection('conversations')
		.getFullList({ filter: pb.filter('requestedItem = {:itemId}', { itemId }) });

	for (const conversation of conversations) {
		await deleteConversation(pb, conversation.id);
	}

	await pb.collection('items').delete(itemId);
	return true;
}

/**
 * Deletes multiple items by calling deleteItem() for each.
 * Skips items that are not found or not owned by ownerUserId.
 * Returns the count of items actually deleted.
 */
export async function deleteMultipleItems(
	pb: PocketBase,
	itemIds: string[],
	ownerUserId: string
): Promise<number> {
	let count = 0;
	for (const itemId of itemIds) {
		try {
			const deleted = await deleteItem(pb, itemId, ownerUserId);
			if (deleted) count++;
		} catch (err: unknown) {
			console.error('Failed to delete item', itemId, err instanceof Error ? err.message : err);
		}
	}
	return count;
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
