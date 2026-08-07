import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMockPb } from '$lib/test-utils/pocketbase';

// Avoid loading the real notifications module (web-push + VAPID env) at import time.
vi.mock('$lib/server/notifications.js', () => ({
	createNotification: vi.fn(),
	sendPushToUser: vi.fn(),
	isMessageNotificationThrottled: vi.fn(),
	notifyAndPush: vi.fn(),
}));

import { sendMessage } from './conversation.server';
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
