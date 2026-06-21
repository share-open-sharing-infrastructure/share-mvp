import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocked dependency: assert the delete action routes conversation deletion through it.
const { deleteConversationMock } = vi.hoisted(() => ({ deleteConversationMock: vi.fn() }));
vi.mock('../../conversations/[conversationId]/conversation.server', () => ({
	deleteConversation: deleteConversationMock,
}));
// hooks.server.ts (re-exported by +page.server) reads PUBLIC_PB_URL from here.
vi.mock('$env/static/public', () => ({ PUBLIC_PB_URL: 'http://localhost', PUBLIC_VAPID_PUBLIC_KEY: 'x' }));

import { actions } from './+page.server';

function mockFilter(raw: string, params?: Record<string, unknown>): string {
	if (!params) return raw;
	let result = raw;
	for (const [key, value] of Object.entries(params)) {
		const escaped = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : `${value}`;
		result = result.replaceAll(`{:${key}}`, escaped);
	}
	return result;
}

type DeleteEvent = Parameters<typeof actions.delete>[0];

function setup(conversations: { id: string }[]) {
	const convGetFullList = vi.fn().mockResolvedValue(conversations);
	const itemsDelete = vi.fn().mockResolvedValue(true);
	const pb = {
		collection: vi.fn((name: string) =>
			name === 'conversations' ? { getFullList: convGetFullList } : { delete: itemsDelete }
		),
		filter: vi.fn(mockFilter),
	};
	return { pb, convGetFullList, itemsDelete };
}

function callDelete(pb: unknown, itemId?: string) {
	const fd = new FormData();
	if (itemId !== undefined) fd.set('itemId', itemId);
	return actions.delete({
		locals: { pb },
		request: { formData: vi.fn().mockResolvedValue(fd) },
	} as unknown as DeleteEvent);
}

describe('user items: delete action', () => {
	beforeEach(() => vi.clearAllMocks());

	it('routes each conversation deletion through deleteConversation, then deletes the item', async () => {
		const { pb, itemsDelete } = setup([{ id: 'c1' }, { id: 'c2' }]);

		await callDelete(pb, 'item1');

		expect(deleteConversationMock).toHaveBeenCalledTimes(2);
		expect(deleteConversationMock).toHaveBeenCalledWith(pb, 'c1');
		expect(deleteConversationMock).toHaveBeenCalledWith(pb, 'c2');
		expect(itemsDelete).toHaveBeenCalledWith('item1');
	});

	it('deletes the item even when it has no conversations', async () => {
		const { pb, itemsDelete } = setup([]);

		await callDelete(pb, 'item1');

		expect(deleteConversationMock).not.toHaveBeenCalled();
		expect(itemsDelete).toHaveBeenCalledWith('item1');
	});

	it('does nothing when no itemId is supplied', async () => {
		const { pb, itemsDelete } = setup([]);

		await callDelete(pb, undefined);

		expect(deleteConversationMock).not.toHaveBeenCalled();
		expect(itemsDelete).not.toHaveBeenCalled();
	});

	it('does not delete the item if a conversation deletion fails (error is swallowed)', async () => {
		const { pb, itemsDelete } = setup([{ id: 'c1' }]);
		deleteConversationMock.mockRejectedValueOnce(new Error('boom'));

		await expect(callDelete(pb, 'item1')).resolves.toBeUndefined();
		expect(itemsDelete).not.toHaveBeenCalled();
	});
});
