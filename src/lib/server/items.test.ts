import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteItem, deleteMultipleItems, setItemStatus } from './items';

vi.mock('../../routes/conversations/[conversationId]/conversation.server', () => ({
	deleteConversation: vi.fn().mockResolvedValue(undefined),
}));

import { deleteConversation } from '../../routes/conversations/[conversationId]/conversation.server';

const OWNER_ID = 'user123';
const OTHER_ID = 'user999';

/**
 * Builds a mock PocketBase.
 *
 * Conversations getFullList is called twice per deleteItem:
 *   1. open-guard query  — filter contains "lendingStatus"
 *   2. cascade query     — filter contains only the item ID
 *
 * We distinguish them via the filter string so each collection() call
 * can return the right data regardless of how many times the factory is invoked.
 */
function makePb({
	item,
	openConversations = [],
	allConversations = [],
}: {
	item?: { id: string; owner: string } | null;
	openConversations?: { id: string }[];
	allConversations?: { id: string }[];
}) {
	const getOne =
		item === null
			? vi.fn().mockRejectedValue(new Error('not found'))
			: vi.fn().mockResolvedValue(item);
	const deleteRecord = vi.fn().mockResolvedValue(undefined);
	const update = vi.fn().mockResolvedValue(undefined);

	const getFullList = vi.fn(({ filter }: { filter?: string } = {}) =>
		typeof filter === 'string' && filter.includes('lendingStatus')
			? Promise.resolve(openConversations)
			: Promise.resolve(allConversations)
	);

	const pb = {
		collection: vi.fn((name: string) => {
			if (name === 'items') return { getOne, delete: deleteRecord, update };
			if (name === 'conversations') return { getFullList };
			return {};
		}),
		filter: (raw: string, params?: Record<string, unknown>) => {
			if (!params) return raw;
			return Object.entries(params).reduce(
				(acc, [k, v]) => acc.replace(`{:${k}}`, String(v)),
				raw
			);
		},
		_deleteRecord: deleteRecord,
		_update: update,
		_getOne: getOne,
		_getFullList: getFullList,
	};
	return pb as unknown as Parameters<typeof deleteItem>[0] & typeof pb;
}

describe('deleteItem', () => {
	beforeEach(() => vi.clearAllMocks());

	it('deletes conversations and item when caller is owner and no open conversations exist', async () => {
		const pb = makePb({
			item: { id: 'item1', owner: OWNER_ID },
			openConversations: [],
			allConversations: [{ id: 'conv1' }, { id: 'conv2' }],
		});

		const result = await deleteItem(pb, 'item1', OWNER_ID);

		expect(result).toEqual({ status: 'deleted' });
		expect(deleteConversation).toHaveBeenCalledTimes(2);
		expect(deleteConversation).toHaveBeenCalledWith(pb, 'conv1');
		expect(deleteConversation).toHaveBeenCalledWith(pb, 'conv2');
		expect(pb._deleteRecord).toHaveBeenCalledWith('item1');
	});

	it('returns has_open_conversations and deletes nothing when open conversations exist', async () => {
		const pb = makePb({
			item: { id: 'item1', owner: OWNER_ID },
			openConversations: [{ id: 'conv-active' }],
		});

		const result = await deleteItem(pb, 'item1', OWNER_ID);

		expect(result).toEqual({ status: 'has_open_conversations', conversationIds: ['conv-active'] });
		expect(deleteConversation).not.toHaveBeenCalled();
		expect(pb._deleteRecord).not.toHaveBeenCalled();
	});

	it('returns not_owner and deletes nothing when caller is not the owner', async () => {
		const pb = makePb({ item: { id: 'item1', owner: OWNER_ID } });

		const result = await deleteItem(pb, 'item1', OTHER_ID);

		expect(result).toEqual({ status: 'not_owner' });
		expect(deleteConversation).not.toHaveBeenCalled();
		expect(pb._deleteRecord).not.toHaveBeenCalled();
	});

	it('returns not_found when item does not exist', async () => {
		const pb = makePb({ item: null });

		const result = await deleteItem(pb, 'nonexistent', OWNER_ID);

		expect(result).toEqual({ status: 'not_found' });
		expect(pb._deleteRecord).not.toHaveBeenCalled();
	});
});

describe('deleteMultipleItems', () => {
	beforeEach(() => vi.clearAllMocks());

	it('deletes items without open conversations and collects blocked ones', async () => {
		// item1: owned, no open convs → deleted
		// item2: owned, has open conv → blocked
		const itemMap: Record<string, { id: string; owner: string }> = {
			item1: { id: 'item1', owner: OWNER_ID },
			item2: { id: 'item2', owner: OWNER_ID },
		};
		const openConvsByItemId: Record<string, { id: string }[]> = {
			item1: [],
			item2: [{ id: 'conv-open' }],
		};

		const pb = {
			collection: vi.fn((name: string) => {
				if (name === 'items') {
					return {
						getOne: vi.fn((id: string) => Promise.resolve(itemMap[id])),
						delete: vi.fn().mockResolvedValue(undefined),
					};
				}
				if (name === 'conversations') {
					return {
						getFullList: vi.fn(({ filter }: { filter?: string } = {}) => {
							if (typeof filter === 'string' && filter.includes('lendingStatus')) {
								// Open guard — derive item ID from the filter string
								for (const [itemId, convs] of Object.entries(openConvsByItemId)) {
									if (filter.includes(itemId)) return Promise.resolve(convs);
								}
								return Promise.resolve([]);
							}
							return Promise.resolve([]); // cascade — no remaining convs
						}),
					};
				}
				return {};
			}),
			filter: (raw: string, params?: Record<string, unknown>) => {
				if (!params) return raw;
				return Object.entries(params).reduce(
					(acc, [k, v]) => acc.replace(`{:${k}}`, String(v)),
					raw
				);
			},
		} as unknown as Parameters<typeof deleteMultipleItems>[0];

		const { deleted, blocked } = await deleteMultipleItems(pb, ['item1', 'item2'], OWNER_ID);

		expect(deleted).toBe(1);
		expect(blocked).toHaveLength(1);
		expect(blocked[0].itemId).toBe('item2');
		expect(blocked[0].conversationIds).toEqual(['conv-open']);
	});

	it('returns deleted=0, blocked=[] when itemIds is empty', async () => {
		const pb = makePb({ item: { id: 'x', owner: OWNER_ID } });
		const result = await deleteMultipleItems(pb, [], OWNER_ID);
		expect(result).toEqual({ deleted: 0, blocked: [] });
	});
});

describe('setItemStatus', () => {
	beforeEach(() => vi.clearAllMocks());

	it('updates status when caller is owner', async () => {
		const pb = makePb({ item: { id: 'item1', owner: OWNER_ID } });

		const result = await setItemStatus(pb, 'item1', OWNER_ID, 'unavailable');

		expect(result).toBe(true);
		expect(pb._update).toHaveBeenCalledWith('item1', { status: 'unavailable' });
	});

	it('returns false and does not update when caller is not the owner', async () => {
		const pb = makePb({ item: { id: 'item1', owner: OWNER_ID } });

		const result = await setItemStatus(pb, 'item1', OTHER_ID, 'available');

		expect(result).toBe(false);
		expect(pb._update).not.toHaveBeenCalled();
	});

	it('returns false when item is not found', async () => {
		const pb = makePb({ item: null });

		const result = await setItemStatus(pb, 'nonexistent', OWNER_ID, 'available');

		expect(result).toBe(false);
	});
});
