import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMockPb } from '$lib/test-utils/pocketbase';
import { texts } from '$lib/texts';
import { requirementRegistry } from '$lib/server/lendingRequirements';
import {
	deleteConversation,
	findResumableConversation,
	startConversationAndNotify,
} from './conversations';

vi.mock('$lib/server/notifications', () => ({
	createNotification: vi.fn().mockResolvedValue(undefined),
	sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

import { createNotification, sendPushToUser } from '$lib/server/notifications';

describe('findResumableConversation', () => {
	it('returns the newest matching open conversation id', async () => {
		const getFullList = vi.fn().mockResolvedValue([{ id: 'conv-new' }, { id: 'conv-old' }]);
		const pb = makeMockPb({ conversations: { getFullList } });

		expect(await findResumableConversation(pb, 'u1', 'item1')).toBe('conv-new');
		expect(getFullList).toHaveBeenCalledWith(
			expect.objectContaining({ sort: '-created', fields: 'id' })
		);
		// Filter excludes rejected/completed/empty — it must scope to the open states.
		expect(getFullList.mock.calls[0][0].filter).toContain('lendingStatus');
	});

	it('returns null when no conversation matches', async () => {
		const pb = makeMockPb({ conversations: { getFullList: vi.fn().mockResolvedValue([]) } });
		expect(await findResumableConversation(pb, 'u1', 'item1')).toBeNull();
	});

	it('returns null when the lookup fails (resume is best-effort)', async () => {
		const pb = makeMockPb({
			conversations: { getFullList: vi.fn().mockRejectedValue(new Error('boom')) },
		});
		expect(await findResumableConversation(pb, 'u1', 'item1')).toBeNull();
	});
});

describe('startConversationAndNotify', () => {
	beforeEach(() => vi.clearAllMocks());

	const requester = { id: 'u1', username: 'Anna' };
	const item = { id: 'item1', ownerId: 'owner1', name: 'Bohrmaschine' };

	it('creates a pending conversation and notifies the owner (in-app + push)', async () => {
		const create = vi.fn().mockResolvedValue({ id: 'conv1' });
		const pb = makeMockPb({ conversations: { create } });

		const result = await startConversationAndNotify(pb, requester, item);

		expect(result).toEqual({ status: 'ok', conversationId: 'conv1' });
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				requester: 'u1',
				itemOwner: 'owner1',
				requestedItem: 'item1',
				lendingStatus: 'pending',
				readByRequester: true,
				readByOwner: false,
			})
		);
		expect(createNotification).toHaveBeenCalledWith(
			pb,
			'owner1',
			'u1',
			'new_request',
			'conv1',
			expect.stringContaining('Anna')
		);
		expect(sendPushToUser).toHaveBeenCalledWith(
			pb,
			'owner1',
			texts.notifications.pushTitle,
			expect.stringContaining('Anna'),
			'/conversations/conv1'
		);
	});

	it('reads the real item name from base items when the public row was masked', async () => {
		const create = vi.fn().mockResolvedValue({ id: 'conv1' });
		const getOne = vi.fn().mockResolvedValue({ name: 'Geheime Säge' });
		const pb = makeMockPb({ conversations: { create }, items: { getOne } });

		await startConversationAndNotify(pb, requester, { ...item, name: null });

		expect(getOne).toHaveBeenCalledWith('item1', { fields: 'name' });
		expect(createNotification).toHaveBeenCalledWith(
			pb,
			'owner1',
			'u1',
			'new_request',
			'conv1',
			expect.stringContaining('Geheime Säge')
		);
	});

	it("maps the backend hook's lending_requirement_unmet rejection to a friendly 403", async () => {
		const def = requirementRegistry[0];
		const create = vi
			.fn()
			.mockRejectedValue(
				Object.assign(new Error(`lending_requirement_unmet: ${def.key}`), { status: 400 })
			);
		const pb = makeMockPb({ conversations: { create } });

		const result = await startConversationAndNotify(pb, requester, item);

		expect(result.status).toBe('error');
		if (result.status !== 'error') throw new Error('unreachable');
		expect(result.httpStatus).toBe(403);
		expect(result.message).toContain(texts.lendingRequirements.blockedIntro);
		expect(result.message).toContain(def.label);
		expect(createNotification).not.toHaveBeenCalled();
	});

	it('maps any other create failure to an error result instead of throwing (terms-route regression)', async () => {
		const create = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { status: 400 }));
		const pb = makeMockPb({ conversations: { create } });

		const result = await startConversationAndNotify(pb, requester, item);

		expect(result).toEqual({
			status: 'error',
			httpStatus: 400,
			message: texts.errors.failedToCreateConversation,
		});
		expect(createNotification).not.toHaveBeenCalled();
		expect(sendPushToUser).not.toHaveBeenCalled();
	});
});

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
