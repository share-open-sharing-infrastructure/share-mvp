import { describe, it, expect, vi } from 'vitest';
import { makeMockPb } from '$lib/test-utils/pocketbase';
import { deleteConversation } from './conversations';

describe('deleteConversation', () => {
	it('deletes the conversation and every notification referencing it', async () => {
		const convDelete = vi.fn().mockResolvedValue(true);
		const notifDelete = vi.fn().mockResolvedValue(true);
		const pb = makeMockPb({
			conversations: { delete: convDelete },
			notifications: {
				getFullList: vi.fn().mockResolvedValue([{ id: 'n1' }, { id: 'n2' }]),
				delete: notifDelete,
			},
		});

		await deleteConversation(pb, 'conv1');

		expect(convDelete).toHaveBeenCalledWith('conv1');
		expect(notifDelete).toHaveBeenCalledTimes(2);
		expect(notifDelete).toHaveBeenCalledWith('n1');
		expect(notifDelete).toHaveBeenCalledWith('n2');
	});

	it('deletes the conversation even when no notifications reference it', async () => {
		const convDelete = vi.fn().mockResolvedValue(true);
		const notifDelete = vi.fn();
		const pb = makeMockPb({
			conversations: { delete: convDelete },
			notifications: { getFullList: vi.fn().mockResolvedValue([]), delete: notifDelete },
		});

		await deleteConversation(pb, 'conv1');

		expect(convDelete).toHaveBeenCalledWith('conv1');
		expect(notifDelete).not.toHaveBeenCalled();
	});

	it('swallows a notification-cleanup failure (does not rethrow)', async () => {
		const pb = makeMockPb({
			conversations: { delete: vi.fn().mockResolvedValue(true) },
			notifications: { getFullList: vi.fn().mockRejectedValue(new Error('boom')), delete: vi.fn() },
		});

		await expect(deleteConversation(pb, 'conv1')).resolves.toBeUndefined();
	});

	it('propagates a conversation-deletion failure (it is outside the cleanup try/catch)', async () => {
		const pb = makeMockPb({
			conversations: { delete: vi.fn().mockRejectedValue(new Error('cannot delete')) },
			notifications: { getFullList: vi.fn(), delete: vi.fn() },
		});

		await expect(deleteConversation(pb, 'conv1')).rejects.toThrow('cannot delete');
	});
});
