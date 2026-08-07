import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMockPb } from '$lib/test-utils/pocketbase';

// Avoid loading the real notifications module (web-push + VAPID env) at import time.
vi.mock('$lib/server/notifications.js', () => ({
	createNotification: vi.fn(),
	sendPushToUser: vi.fn(),
	isMessageNotificationThrottled: vi.fn(),
	notifyAndPush: vi.fn(),
}));

import { sendMessage, markConversationRead } from './conversation.server';
import { notifyAndPush } from '$lib/server/notifications.js';

describe('sendMessage', () => {
	beforeEach(() => vi.clearAllMocks());

	it('creates the message with conversation relation and atomically appends it via the messages+ modifier', async () => {
		const msgCreate = vi.fn().mockResolvedValue({ id: 'msg1' });
		const convUpdate = vi.fn().mockResolvedValue(true);
		const pb = makeMockPb({
			messages: { create: msgCreate },
			conversations: { update: convUpdate },
		});

		const { isMessageNotificationThrottled } = await import('$lib/server/notifications.js');
		vi.mocked(isMessageNotificationThrottled).mockResolvedValue(true);

		await sendMessage(pb, 'conv1', 'Hello!', { fromUserId: 'userB', toUserId: 'userA', senderName: 'Owner', recipientIsRequester: true });

		// messages.create is called with conversation relation
		expect(msgCreate).toHaveBeenCalledWith({
			messageContent: 'Hello!',
			from: 'userB',
			to: 'userA',
			conversation: 'conv1',
		});

		// conversations.update appends the new message id atomically via the 'messages+'
		// modifier (no read-modify-write, no race under concurrent sends), and sets
		// lastMessageAt but NOT requesterLastSeenAt or ownerLastSeenAt.
		expect(convUpdate).toHaveBeenCalledTimes(1);
		const [, updatePayload] = convUpdate.mock.calls[0];
		expect(updatePayload).toMatchObject({ 'messages+': 'msg1' });
		expect(updatePayload).toHaveProperty('lastMessageAt');
		expect(updatePayload).not.toHaveProperty('messages');
		expect(updatePayload).not.toHaveProperty('requesterLastSeenAt');
		expect(updatePayload).not.toHaveProperty('ownerLastSeenAt');
	});

	it('marks readByRequester as false when the recipient is the requester', async () => {
		const msgCreate = vi.fn().mockResolvedValue({ id: 'msg2' });
		const convUpdate = vi.fn().mockResolvedValue(true);
		const pb = makeMockPb({
			messages: { create: msgCreate },
			conversations: { update: convUpdate },
		});

		const { isMessageNotificationThrottled } = await import('$lib/server/notifications.js');
		vi.mocked(isMessageNotificationThrottled).mockResolvedValue(true);

		// Send from owner (userB) to requester (userA)
		await sendMessage(pb, 'conv1', 'Hey', { fromUserId: 'userB', toUserId: 'userA', senderName: 'Owner', recipientIsRequester: true });

		const updatePayload = convUpdate.mock.calls[0][1];
		expect(updatePayload).toHaveProperty('readByRequester', false);
		expect(updatePayload).not.toHaveProperty('readByOwner');
	});

	it('marks readByOwner as false when the recipient is the owner', async () => {
		const msgCreate = vi.fn().mockResolvedValue({ id: 'msg3' });
		const convUpdate = vi.fn().mockResolvedValue(true);
		const pb = makeMockPb({
			messages: { create: msgCreate },
			conversations: { update: convUpdate },
		});

		const { isMessageNotificationThrottled } = await import('$lib/server/notifications.js');
		vi.mocked(isMessageNotificationThrottled).mockResolvedValue(true);

		// Send from requester (userA) to owner (userB)
		await sendMessage(pb, 'conv1', 'Hi', { fromUserId: 'userA', toUserId: 'userB', senderName: 'Requester', recipientIsRequester: false });

		const updatePayload = convUpdate.mock.calls[0][1];
		expect(updatePayload).toHaveProperty('readByOwner', false);
		expect(updatePayload).not.toHaveProperty('readByRequester');
	});

	it('notifies and pushes to the recipient via notifyAndPush when not throttled', async () => {
		const msgCreate = vi.fn().mockResolvedValue({ id: 'msg4' });
		const pb = makeMockPb({
			messages: { create: msgCreate },
			conversations: { update: vi.fn().mockResolvedValue(true) },
		});

		const { isMessageNotificationThrottled } = await import('$lib/server/notifications.js');
		vi.mocked(isMessageNotificationThrottled).mockResolvedValue(false);

		await sendMessage(pb, 'conv1', 'Hi', { fromUserId: 'userA', toUserId: 'userB', senderName: 'Requester', recipientIsRequester: false });

		expect(notifyAndPush).toHaveBeenCalledWith(pb, {
			recipient: 'userB',
			sender: 'userA',
			type: 'new_message',
			relatedId: 'conv1',
			body: expect.any(String),
		});
	});

	it('does not notify when the message-notification cooldown is active', async () => {
		const msgCreate = vi.fn().mockResolvedValue({ id: 'msg5' });
		const pb = makeMockPb({
			messages: { create: msgCreate },
			conversations: { update: vi.fn().mockResolvedValue(true) },
		});

		const { isMessageNotificationThrottled } = await import('$lib/server/notifications.js');
		vi.mocked(isMessageNotificationThrottled).mockResolvedValue(true);

		await sendMessage(pb, 'conv1', 'Hi', { fromUserId: 'userA', toUserId: 'userB', senderName: 'Requester', recipientIsRequester: false });

		expect(notifyAndPush).not.toHaveBeenCalled();
	});
});

describe('markConversationRead', () => {
	beforeEach(() => vi.clearAllMocks());

	// The caller (the `markRead` action) fetches the conversation and hands the record in —
	// markConversationRead never re-fetches, so no conversations.getOne is stubbed here.
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

		// Requester's side is already read → no write (idempotent; the page re-fires markRead
		// on every realtime unread signal, so this must stay a no-op).
		await markConversationRead(pb, convRecord({ readByRequester: true, readByOwner: false }), 'userA');

		expect(convUpdate).not.toHaveBeenCalled();
	});

	it('marks matching unread notifications read (and passes caller/conversation as pb.filter params)', async () => {
		const notifUpdate = vi.fn().mockResolvedValue(true);
		const pb = makeMockPb({
			conversations: { update: vi.fn() },
			notifications: {
				getFullList: vi.fn().mockResolvedValue([{ id: 'n1' }, { id: 'n2' }]),
				update: notifUpdate,
			},
		});

		await markConversationRead(pb, convRecord({ readByRequester: true, readByOwner: true }), 'userA');

		// Bound params, never interpolation (filter-injection guardrail).
		expect(pb.filter).toHaveBeenCalledWith(
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
