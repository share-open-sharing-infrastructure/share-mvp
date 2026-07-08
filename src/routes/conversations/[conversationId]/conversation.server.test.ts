import { describe, it, expect, vi } from 'vitest';
import type PocketBase from 'pocketbase';

// Avoid loading the real notifications module (web-push + VAPID env) at import time.
vi.mock('$lib/server/notifications.js', () => ({
	createNotification: vi.fn(),
	sendPushToUser: vi.fn(),
	isMessageNotificationThrottled: vi.fn(),
}));

import { deleteConversation, sendMessage } from './conversation.server';

function mockFilter(raw: string, params?: Record<string, unknown>): string {
	if (!params) return raw;
	let result = raw;
	for (const [key, value] of Object.entries(params)) {
		const escaped = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : `${value}`;
		result = result.replaceAll(`{:${key}}`, escaped);
	}
	return result;
}

function makeMockPb(impls: Record<string, Record<string, ReturnType<typeof vi.fn>>>): PocketBase {
	return {
		collection: vi.fn((name: string) => impls[name]),
		filter: vi.fn(mockFilter),
	} as unknown as PocketBase;
}

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

describe('sendMessage', () => {
	it('creates the message with conversation relation and updates lastMessageAt (not *LastSeenAt)', async () => {
		const msgCreate = vi.fn().mockResolvedValue({ id: 'msg1' });
		const convGetOne = vi.fn().mockResolvedValue({
			id: 'conv1',
			requester: 'userA',
			itemOwner: 'userB',
			messages: ['msg0'],
		});
		const convUpdate = vi.fn().mockResolvedValue(true);
		const pb = makeMockPb({
			messages: { create: msgCreate },
			conversations: { getOne: convGetOne, update: convUpdate },
			notifications: {
				getFullList: vi.fn().mockResolvedValue([]),
				delete: vi.fn(),
			},
		});

		const { isMessageNotificationThrottled } = await import('$lib/server/notifications.js');
		vi.mocked(isMessageNotificationThrottled).mockResolvedValue(true);

		await sendMessage(pb, 'conv1', 'Hello!', 'userB', 'userA', 'Owner');

		// messages.create is called with conversation relation
		expect(msgCreate).toHaveBeenCalledWith({
			messageContent: 'Hello!',
			from: 'userB',
			to: 'userA',
			conversation: 'conv1',
		});

		// conversations.update sets lastMessageAt but NOT requesterLastSeenAt or ownerLastSeenAt
		expect(convUpdate).toHaveBeenCalledTimes(1);
		const updatePayload = convUpdate.mock.calls[0][1];
		expect(updatePayload).toHaveProperty('lastMessageAt');
		expect(updatePayload).not.toHaveProperty('requesterLastSeenAt');
		expect(updatePayload).not.toHaveProperty('ownerLastSeenAt');
	});

	it('marks readByRequester as false when sending to the requester', async () => {
		const msgCreate = vi.fn().mockResolvedValue({ id: 'msg2' });
		const convGetOne = vi.fn().mockResolvedValue({
			id: 'conv1',
			requester: 'userA',
			itemOwner: 'userB',
			messages: [],
		});
		const convUpdate = vi.fn().mockResolvedValue(true);
		const pb = makeMockPb({
			messages: { create: msgCreate },
			conversations: { getOne: convGetOne, update: convUpdate },
			notifications: {
				getFullList: vi.fn().mockResolvedValue([]),
				delete: vi.fn(),
			},
		});

		const { isMessageNotificationThrottled } = await import('$lib/server/notifications.js');
		vi.mocked(isMessageNotificationThrottled).mockResolvedValue(true);

		// Send from owner (userB) to requester (userA)
		await sendMessage(pb, 'conv1', 'Hey', 'userB', 'userA', 'Owner');

		const updatePayload = convUpdate.mock.calls[0][1];
		expect(updatePayload).toHaveProperty('readByRequester', false);
		expect(updatePayload).not.toHaveProperty('readByOwner');
	});

	it('marks readByOwner as false when sending to the owner', async () => {
		const msgCreate = vi.fn().mockResolvedValue({ id: 'msg3' });
		const convGetOne = vi.fn().mockResolvedValue({
			id: 'conv1',
			requester: 'userA',
			itemOwner: 'userB',
			messages: ['msg0'],
		});
		const convUpdate = vi.fn().mockResolvedValue(true);
		const pb = makeMockPb({
			messages: { create: msgCreate },
			conversations: { getOne: convGetOne, update: convUpdate },
			notifications: {
				getFullList: vi.fn().mockResolvedValue([]),
				delete: vi.fn(),
			},
		});

		const { isMessageNotificationThrottled } = await import('$lib/server/notifications.js');
		vi.mocked(isMessageNotificationThrottled).mockResolvedValue(true);

		// Send from requester (userA) to owner (userB)
		await sendMessage(pb, 'conv1', 'Hi', 'userA', 'userB', 'Requester');

		const updatePayload = convUpdate.mock.calls[0][1];
		expect(updatePayload).toHaveProperty('readByOwner', false);
		expect(updatePayload).not.toHaveProperty('readByRequester');
	});
});
