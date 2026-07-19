import { describe, it, expect, vi, beforeEach } from 'vitest';
import type PocketBase from 'pocketbase';
import { texts } from '$lib/texts';

// Avoid loading the real notifications module (web-push + VAPID env) at import time.
vi.mock('$lib/server/notifications.js', () => ({
	createNotification: vi.fn(),
	sendPushToUser: vi.fn(),
	isMessageNotificationThrottled: vi.fn(),
}));

import { abortRequest } from './lending.server';
import { createNotification, sendPushToUser } from '$lib/server/notifications.js';

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

// A conversation between userA (requester) and userB (owner) for item1.
function conversation(overrides: Record<string, unknown> = {}) {
	return {
		id: 'conv1',
		requester: 'userA',
		itemOwner: 'userB',
		requestedItem: 'item1',
		lendingStatus: 'pending',
		...overrides,
	};
}

/** pb wired for a successful abort; `itemUpdate` lets tests assert the item is untouched. */
function pbForAbort(conv: Record<string, unknown>) {
	const convUpdate = vi.fn().mockResolvedValue(true);
	const itemUpdate = vi.fn().mockResolvedValue(true);
	const pb = makeMockPb({
		conversations: { getOne: vi.fn().mockResolvedValue(conv), update: convUpdate },
		items: { getOne: vi.fn().mockResolvedValue({ id: 'item1', name: 'Bohrmaschine' }), update: itemUpdate },
	});
	return { pb, convUpdate, itemUpdate };
}

describe('abortRequest', () => {
	beforeEach(() => vi.clearAllMocks());

	it('requester aborts a pending request: status → aborted, notifies the owner, no item update', async () => {
		const { pb, convUpdate, itemUpdate } = pbForAbort(conversation({ lendingStatus: 'pending' }));

		const result = await abortRequest(pb, 'conv1', 'userA');

		expect(result).toBeUndefined(); // void on success
		expect(convUpdate).toHaveBeenCalledWith('conv1', { lendingStatus: 'aborted' });
		// The frontend must NOT touch the item — the backend hook frees it.
		expect(itemUpdate).not.toHaveBeenCalled();

		const body = texts.notifications.requestAborted('Bohrmaschine');
		// Counterparty of the requester (userA) is the owner (userB).
		expect(createNotification).toHaveBeenCalledWith(pb, 'userB', 'userA', 'request_aborted', 'conv1', body);
		expect(sendPushToUser).toHaveBeenCalledWith(pb, 'userB', texts.notifications.pushTitle, body, '/conversations/conv1');
	});

	it('owner aborts an accepted request: status → aborted, notifies the requester', async () => {
		const { pb, convUpdate, itemUpdate } = pbForAbort(conversation({ lendingStatus: 'accepted' }));

		const result = await abortRequest(pb, 'conv1', 'userB');

		expect(result).toBeUndefined();
		expect(convUpdate).toHaveBeenCalledWith('conv1', { lendingStatus: 'aborted' });
		expect(itemUpdate).not.toHaveBeenCalled();

		const body = texts.notifications.requestAborted('Bohrmaschine');
		// Counterparty of the owner (userB) is the requester (userA).
		expect(createNotification).toHaveBeenCalledWith(pb, 'userA', 'userB', 'request_aborted', 'conv1', body);
		expect(sendPushToUser).toHaveBeenCalledWith(pb, 'userA', texts.notifications.pushTitle, body, '/conversations/conv1');
	});

	it('rejects an abort from a non-abortable state with fail(400) and no writes', async () => {
		const { pb, convUpdate } = pbForAbort(conversation({ lendingStatus: 'active' }));

		const result = await abortRequest(pb, 'conv1', 'userA');

		expect(result).toMatchObject({ status: 400 });
		expect(convUpdate).not.toHaveBeenCalled();
		expect(createNotification).not.toHaveBeenCalled();
		expect(sendPushToUser).not.toHaveBeenCalled();
	});

	it('rejects an abort from a non-participant with fail(403) and no writes', async () => {
		const { pb, convUpdate } = pbForAbort(conversation({ lendingStatus: 'pending' }));

		const result = await abortRequest(pb, 'conv1', 'stranger');

		expect(result).toMatchObject({ status: 403 });
		expect(convUpdate).not.toHaveBeenCalled();
		expect(createNotification).not.toHaveBeenCalled();
	});
});
