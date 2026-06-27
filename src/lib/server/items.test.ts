import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteItem, deleteMultipleItems, setItemStatus } from './items';

vi.mock('../../routes/conversations/[conversationId]/conversation.server', () => ({
	deleteConversation: vi.fn().mockResolvedValue(undefined),
}));

import { deleteConversation } from '../../routes/conversations/[conversationId]/conversation.server';

const OWNER_ID = 'user123';
const OTHER_ID = 'user999';

function makePb({
	item,
	conversations = [],
}: {
	item?: { id: string; owner: string } | null;
	conversations?: { id: string }[];
}) {
	const getOne = item === null ? vi.fn().mockRejectedValue(new Error('not found')) : vi.fn().mockResolvedValue(item);
	const deleteRecord = vi.fn().mockResolvedValue(undefined);
	const update = vi.fn().mockResolvedValue(undefined);
	const getFullList = vi.fn().mockResolvedValue(conversations);

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

	it('deletes conversations and item when caller is owner', async () => {
		const pb = makePb({
			item: { id: 'item1', owner: OWNER_ID },
			conversations: [{ id: 'conv1' }, { id: 'conv2' }],
		});

		const result = await deleteItem(pb, 'item1', OWNER_ID);

		expect(result).toBe(true);
		expect(deleteConversation).toHaveBeenCalledTimes(2);
		expect(deleteConversation).toHaveBeenCalledWith(pb, 'conv1');
		expect(deleteConversation).toHaveBeenCalledWith(pb, 'conv2');
		expect(pb._deleteRecord).toHaveBeenCalledWith('item1');
	});

	it('returns false and deletes nothing when caller is not the owner', async () => {
		const pb = makePb({ item: { id: 'item1', owner: OWNER_ID } });

		const result = await deleteItem(pb, 'item1', OTHER_ID);

		expect(result).toBe(false);
		expect(deleteConversation).not.toHaveBeenCalled();
		expect(pb._deleteRecord).not.toHaveBeenCalled();
	});

	it('returns false when item is not found', async () => {
		const pb = makePb({ item: null });

		const result = await deleteItem(pb, 'nonexistent', OWNER_ID);

		expect(result).toBe(false);
		expect(pb._deleteRecord).not.toHaveBeenCalled();
	});
});

describe('deleteMultipleItems', () => {
	beforeEach(() => vi.clearAllMocks());

	it('deletes owned items and skips non-owned, returns correct count', async () => {
		let callCount = 0;
		const pb = {
			collection: vi.fn((name: string) => {
				if (name === 'items') {
					return {
						getOne: vi.fn(() => {
							callCount++;
							// item1 owned, item2 not owned, item3 owned
							const owners = [OWNER_ID, OTHER_ID, OWNER_ID];
							return Promise.resolve({ id: `item${callCount}`, owner: owners[callCount - 1] });
						}),
						delete: vi.fn().mockResolvedValue(undefined),
					};
				}
				if (name === 'conversations') return { getFullList: vi.fn().mockResolvedValue([]) };
				return {};
			}),
			filter: (raw: string) => raw,
		} as unknown as Parameters<typeof deleteMultipleItems>[0];

		const count = await deleteMultipleItems(pb, ['item1', 'item2', 'item3'], OWNER_ID);

		expect(count).toBe(2);
	});

	it('returns 0 when itemIds is empty', async () => {
		const pb = makePb({ item: { id: 'x', owner: OWNER_ID } });
		const count = await deleteMultipleItems(pb, [], OWNER_ID);
		expect(count).toBe(0);
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
