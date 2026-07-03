import { describe, it, expect, vi, beforeEach } from 'vitest';

// The delete action delegates the cascade + open-loan guard to deleteItem();
// that helper is unit-tested in src/lib/server/items.test.ts, so here we only
// assert the action delegates correctly and maps the result.
const { deleteItemMock, deleteMultipleItemsMock, setItemStatusMock } = vi.hoisted(() => ({
	deleteItemMock: vi.fn(),
	deleteMultipleItemsMock: vi.fn(),
	setItemStatusMock: vi.fn(),
}));
vi.mock('$lib/server/items', () => ({
	deleteItem: deleteItemMock,
	deleteMultipleItems: deleteMultipleItemsMock,
	setItemStatus: setItemStatusMock,
}));
// hooks.server.ts (re-exported by +page.server) reads PUBLIC_PB_URL from here.
vi.mock('$env/static/public', () => ({ PUBLIC_PB_URL: 'http://localhost', PUBLIC_VAPID_PUBLIC_KEY: 'x' }));

import { actions } from './+page.server';
import { texts } from '$lib/texts';

type DeleteEvent = Parameters<typeof actions.delete>[0];

const pb = {} as unknown;

function callDelete(itemId?: string) {
	const fd = new FormData();
	if (itemId !== undefined) fd.set('itemId', itemId);
	return actions.delete({
		locals: { pb, user: { id: 'u1' } },
		request: { formData: vi.fn().mockResolvedValue(fd) },
	} as unknown as DeleteEvent);
}

describe('user items: delete action', () => {
	beforeEach(() => vi.clearAllMocks());

	it('delegates to deleteItem with the pb client, item id, and current user id', async () => {
		deleteItemMock.mockResolvedValue({ status: 'deleted' });

		const result = await callDelete('item1');

		expect(deleteItemMock).toHaveBeenCalledWith(pb, 'item1', 'u1');
		expect(result).toBeUndefined();
	});

	it('returns a 409 (with conversation ids) when the item has open conversations', async () => {
		deleteItemMock.mockResolvedValue({
			status: 'has_open_conversations',
			conversationIds: ['c1', 'c2'],
		});

		const result = await callDelete('item1');

		expect(result?.status).toBe(409);
		expect(result?.data).toMatchObject({
			fail: true,
			message: texts.pages.items.deleteBlockedByConversation,
			conversationIds: ['c1', 'c2'],
		});
	});

	it('does nothing when no itemId is supplied', async () => {
		const result = await callDelete(undefined);

		expect(deleteItemMock).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});

	it('swallows errors from deleteItem (resolves without throwing)', async () => {
		deleteItemMock.mockRejectedValueOnce(new Error('boom'));

		await expect(callDelete('item1')).resolves.toBeUndefined();
	});
});
