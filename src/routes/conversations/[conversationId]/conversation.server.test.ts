import { describe, it, expect, vi } from 'vitest';
import type PocketBase from 'pocketbase';

// Avoid loading the real notifications module (web-push + VAPID env) at import time.
vi.mock('$lib/server/notifications.js', () => ({
	createNotification: vi.fn(),
	sendPushToUser: vi.fn(),
	isMessageNotificationThrottled: vi.fn(),
}));

import {
	deleteConversation,
	fetchConversationForParticipant,
	markConversationRead,
	NotParticipantError,
	sendMessage,
} from './conversation.server';

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

describe('fetchConversationForParticipant', () => {
	it('returns the record when the caller is the requester', async () => {
		const record = { id: 'conv1', requester: 'userA', itemOwner: 'userB' };
		const getOne = vi.fn().mockResolvedValue(record);
		const pb = makeMockPb({ conversations: { getOne } });

		await expect(fetchConversationForParticipant(pb, 'conv1', 'userA')).resolves.toBe(record);
		// A single getOne fetching the base fields.
		expect(getOne).toHaveBeenCalledTimes(1);
		expect(getOne).toHaveBeenCalledWith('conv1', { fields: 'id,requester,itemOwner' });
	});

	it('returns the record when the caller is the itemOwner', async () => {
		const record = { id: 'conv1', requester: 'userA', itemOwner: 'userB' };
		const pb = makeMockPb({ conversations: { getOne: vi.fn().mockResolvedValue(record) } });

		await expect(fetchConversationForParticipant(pb, 'conv1', 'userB')).resolves.toBe(record);
	});

	it('appends extraFields to the single getOne', async () => {
		const getOne = vi
			.fn()
			.mockResolvedValue({ id: 'conv1', requester: 'userA', itemOwner: 'userB' });
		const pb = makeMockPb({ conversations: { getOne } });

		await fetchConversationForParticipant(pb, 'conv1', 'userA', 'readByRequester,readByOwner');

		expect(getOne).toHaveBeenCalledTimes(1);
		expect(getOne).toHaveBeenCalledWith('conv1', {
			fields: 'id,requester,itemOwner,readByRequester,readByOwner',
		});
	});

	it('throws NotParticipantError when the caller is neither participant', async () => {
		const pb = makeMockPb({
			conversations: {
				getOne: vi.fn().mockResolvedValue({ id: 'conv1', requester: 'userA', itemOwner: 'userB' }),
			},
		});

		await expect(fetchConversationForParticipant(pb, 'conv1', 'intruder')).rejects.toBeInstanceOf(
			NotParticipantError
		);
	});

	it('throws NotParticipantError when userId is undefined', async () => {
		const pb = makeMockPb({
			conversations: {
				getOne: vi.fn().mockResolvedValue({ id: 'conv1', requester: 'userA', itemOwner: 'userB' }),
			},
		});

		await expect(fetchConversationForParticipant(pb, 'conv1', undefined)).rejects.toBeInstanceOf(
			NotParticipantError
		);
	});

	it('propagates a non-participant error such as a 404 from getOne', async () => {
		const pb = makeMockPb({
			conversations: { getOne: vi.fn().mockRejectedValue(new Error('not found')) },
		});

		await expect(fetchConversationForParticipant(pb, 'missing', 'userA')).rejects.toThrow(
			'not found'
		);
	});
});

describe('markConversationRead', () => {
	// The caller now fetches the conversation (via fetchConversationForParticipant) and hands the
	// record in — markConversationRead no longer re-fetches, so no conversations.getOne here.
	function convRecord(extra: Record<string, unknown> = {}) {
		return {
			id: 'conv1',
			requester: 'userA',
			itemOwner: 'userB',
			readByRequester: false,
			readByOwner: true,
			...extra,
		};
	}

	it('sets readByRequester:true when the caller is the (unread) requester', async () => {
		const convUpdate = vi.fn().mockResolvedValue(true);
		const pb = makeMockPb({
			conversations: { update: convUpdate },
			notifications: { getFullList: vi.fn().mockResolvedValue([]), update: vi.fn() },
		});

		await markConversationRead(pb, convRecord({ readByRequester: false, readByOwner: true }), 'userA');

		expect(convUpdate).toHaveBeenCalledTimes(1);
		expect(convUpdate).toHaveBeenCalledWith('conv1', { readByRequester: true });
	});

	it('sets readByOwner:true when the caller is the (unread) owner', async () => {
		const convUpdate = vi.fn().mockResolvedValue(true);
		const pb = makeMockPb({
			conversations: { update: convUpdate },
			notifications: { getFullList: vi.fn().mockResolvedValue([]), update: vi.fn() },
		});

		await markConversationRead(pb, convRecord({ readByRequester: true, readByOwner: false }), 'userB');

		expect(convUpdate).toHaveBeenCalledTimes(1);
		expect(convUpdate).toHaveBeenCalledWith('conv1', { readByOwner: true });
	});

	it('does NOT update the conversation when it is already read for the caller', async () => {
		const convUpdate = vi.fn();
		const pb = makeMockPb({
			conversations: { update: convUpdate },
			notifications: { getFullList: vi.fn().mockResolvedValue([]), update: vi.fn() },
		});

		// Requester's side is already read → no write.
		await markConversationRead(pb, convRecord({ readByRequester: true, readByOwner: false }), 'userA');

		expect(convUpdate).not.toHaveBeenCalled();
	});

	it('marks matching unread notifications read (and passes the caller/conversation as pb.filter params)', async () => {
		const notifGetFullList = vi.fn().mockResolvedValue([{ id: 'n1' }, { id: 'n2' }]);
		const notifUpdate = vi.fn().mockResolvedValue(true);
		const filter = vi.fn(mockFilter);
		const pb = {
			collection: vi.fn(() => ({
				update: notifUpdate,
				getFullList: notifGetFullList,
			})),
			filter,
		} as unknown as PocketBase;

		await markConversationRead(pb, convRecord({ readByRequester: true, readByOwner: true }), 'userA');

		// pb.filter was called with the caller id + conversation id as bound params (no interpolation).
		expect(filter).toHaveBeenCalledWith(
			'recipient={:userId} && relatedId={:conversationId} && read=false',
			{ userId: 'userA', conversationId: 'conv1' }
		);
		expect(notifUpdate).toHaveBeenCalledTimes(2);
		expect(notifUpdate).toHaveBeenCalledWith('n1', { read: true });
		expect(notifUpdate).toHaveBeenCalledWith('n2', { read: true });
	});

	it('does not update any notification when none are unread', async () => {
		const notifUpdate = vi.fn();
		const pb = makeMockPb({
			conversations: { update: vi.fn() },
			notifications: { getFullList: vi.fn().mockResolvedValue([]), update: notifUpdate },
		});

		await markConversationRead(pb, convRecord({ readByRequester: true, readByOwner: true }), 'userA');

		expect(notifUpdate).not.toHaveBeenCalled();
	});

	it('swallows a per-notification update failure (does not reject)', async () => {
		const pb = makeMockPb({
			conversations: { update: vi.fn() },
			notifications: {
				getFullList: vi.fn().mockResolvedValue([{ id: 'n1' }]),
				update: vi.fn().mockRejectedValue(new Error('boom')),
			},
		});

		await expect(
			markConversationRead(pb, convRecord({ readByRequester: true, readByOwner: true }), 'userA')
		).resolves.toBeUndefined();
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
