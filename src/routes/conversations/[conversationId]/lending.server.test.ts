import { describe, it, expect, vi, beforeEach } from 'vitest';
import type PocketBase from 'pocketbase';
import { texts } from '$lib/texts';
import type { LendingAction, LendingStatus } from '$lib/lending';
import type { NotificationType } from '$lib/types/models';
import { makeMockPb } from '$lib/test-utils/pocketbase';

// Avoid loading the real notifications module (web-push + VAPID env) at import time.
// notifyAndPush is mocked to still call through to createNotification/sendPushToUser (defined
// via vi.hoisted so the factory below can reference them directly, without a fragile
// self-importing dynamic import()) so assertions can keep checking those two directly.
// PUSH_TITLE is a fixed placeholder — decouples these tests from texts.ts content.
const { createNotification, sendPushToUser, isMessageNotificationThrottled, notifyAndPush, PUSH_TITLE } = vi.hoisted(() => {
	const PUSH_TITLE = 'push-title';
	const createNotification = vi.fn();
	const sendPushToUser = vi.fn();
	const isMessageNotificationThrottled = vi.fn();
	const notifyAndPush = vi.fn(
		async (
			pb: PocketBase,
			params: { recipient: string; sender?: string; type: NotificationType; relatedId: string; body: string }
		) => {
			await createNotification(pb, params.recipient, params.sender, params.type, params.relatedId, params.body);
			await sendPushToUser(pb, params.recipient, PUSH_TITLE, params.body, `/conversations/${params.relatedId}`);
		}
	);
	return { createNotification, sendPushToUser, isMessageNotificationThrottled, notifyAndPush, PUSH_TITLE };
});

vi.mock('$lib/server/notifications.js', () => ({
	createNotification,
	sendPushToUser,
	isMessageNotificationThrottled,
	notifyAndPush,
}));

import {
	acceptRequest,
	rejectRequest,
	abortRequest,
	confirmHandover,
	requestReturn,
	confirmReturn,
} from './lending.server';

const OWNER = 'userB';
const REQUESTER = 'userA';
const STRANGER = 'stranger';
const ITEM_NAME = 'Bohrmaschine';

// A conversation between the requester and the item owner for item1.
function conversation(overrides: Record<string, unknown> = {}) {
	return {
		id: 'conv1',
		requester: REQUESTER,
		itemOwner: OWNER,
		requestedItem: 'item1',
		lendingStatus: 'pending',
		...overrides,
	};
}

/** pb wired for a transition; `getFullList` defaults to `[]` (acceptRequest's auto-reject query). */
function pbForTransition(conv: Record<string, unknown>) {
	const convUpdate = vi.fn().mockResolvedValue(true);
	const itemUpdate = vi.fn().mockResolvedValue(true);
	const pb = makeMockPb({
		conversations: { getOne: vi.fn().mockResolvedValue(conv), update: convUpdate, getFullList: vi.fn().mockResolvedValue([]) },
		items: { getOne: vi.fn().mockResolvedValue({ id: 'item1', name: ITEM_NAME }), update: itemUpdate },
	});
	return { pb, convUpdate, itemUpdate };
}

interface Case {
	action: LendingAction;
	/** Calls the transition with the given pb + conversationId + caller. */
	call: (pb: PocketBase, conversationId: string, callerId: string) => ReturnType<typeof acceptRequest>;
	callerId: string;
	wrongRoleCallerId: string;
	validState: LendingStatus;
	invalidState: LendingStatus;
	toStatus: LendingStatus;
	notifyRecipient: string;
	notifyType: NotificationType;
	bodyFor: (itemName: string) => string;
	itemPatch?: { status: 'available' | 'unavailable' };
}

// One row per `?/actionName` form action — role/from/to mirrors $lib/lending.ts's
// LENDING_TRANSITIONS; happy/wrong-role/wrong-state are exercised generically below for
// each row (6 actions × 3 cases = 18 minimum), plus a few action-specific extras.
const CASES: Case[] = [
	{
		action: 'acceptRequest',
		call: (pb, id, callerId) => acceptRequest(pb, id, callerId),
		callerId: OWNER,
		wrongRoleCallerId: REQUESTER,
		validState: 'pending',
		invalidState: 'accepted',
		toStatus: 'accepted',
		notifyRecipient: REQUESTER,
		notifyType: 'request_accepted',
		bodyFor: texts.notifications.requestAccepted,
		itemPatch: { status: 'unavailable' },
	},
	{
		action: 'rejectRequest',
		call: (pb, id, callerId) => rejectRequest(pb, id, callerId),
		callerId: OWNER,
		wrongRoleCallerId: REQUESTER,
		validState: 'pending',
		invalidState: 'active',
		toStatus: 'rejected',
		notifyRecipient: REQUESTER,
		notifyType: 'request_rejected',
		bodyFor: texts.notifications.requestRejected,
	},
	{
		action: 'confirmHandover',
		call: (pb, id, callerId) => confirmHandover(pb, id, callerId),
		callerId: OWNER,
		wrongRoleCallerId: REQUESTER,
		validState: 'accepted',
		invalidState: 'pending',
		toStatus: 'active',
		notifyRecipient: REQUESTER,
		notifyType: 'handover_confirmed',
		bodyFor: texts.notifications.handoverConfirmed,
	},
	{
		action: 'requestReturn',
		call: (pb, id, callerId) => requestReturn(pb, id, callerId, 'Requester Name'),
		callerId: REQUESTER,
		wrongRoleCallerId: OWNER,
		validState: 'active',
		invalidState: 'accepted',
		toStatus: 'return_requested',
		notifyRecipient: OWNER,
		notifyType: 'return_requested',
		bodyFor: (itemName) => texts.notifications.returnRequested('Requester Name', itemName),
	},
	{
		action: 'confirmReturn',
		call: (pb, id, callerId) => confirmReturn(pb, id, callerId),
		callerId: OWNER,
		wrongRoleCallerId: REQUESTER,
		validState: 'active',
		invalidState: 'pending',
		toStatus: 'completed',
		notifyRecipient: REQUESTER,
		notifyType: 'return_confirmed',
		bodyFor: texts.notifications.returnConfirmed,
		itemPatch: { status: 'available' },
	},
	{
		action: 'abortRequest',
		call: (pb, id, callerId) => abortRequest(pb, id, callerId),
		callerId: REQUESTER,
		wrongRoleCallerId: STRANGER,
		validState: 'pending',
		invalidState: 'active',
		toStatus: 'aborted',
		notifyRecipient: OWNER,
		notifyType: 'request_aborted',
		bodyFor: texts.notifications.requestAborted,
	},
];

describe.each(CASES)('$action', (testCase) => {
	beforeEach(() => vi.clearAllMocks());

	it(`transitions ${testCase.validState} → ${testCase.toStatus} and notifies ${testCase.notifyRecipient === OWNER ? 'the owner' : 'the requester'}`, async () => {
		const { pb, convUpdate, itemUpdate } = pbForTransition(conversation({ lendingStatus: testCase.validState }));

		const result = await testCase.call(pb, 'conv1', testCase.callerId);

		expect(result).toBeUndefined(); // void on success
		expect(convUpdate).toHaveBeenCalledTimes(1);
		expect(convUpdate.mock.calls[0][0]).toBe('conv1');
		expect(convUpdate.mock.calls[0][1]).toMatchObject({ lendingStatus: testCase.toStatus });

		if (testCase.itemPatch) {
			expect(itemUpdate).toHaveBeenCalledWith('item1', testCase.itemPatch);
		} else {
			expect(itemUpdate).not.toHaveBeenCalled();
		}

		const body = testCase.bodyFor(ITEM_NAME);
		expect(createNotification).toHaveBeenCalledWith(pb, testCase.notifyRecipient, testCase.callerId, testCase.notifyType, 'conv1', body);
		expect(sendPushToUser).toHaveBeenCalledWith(pb, testCase.notifyRecipient, PUSH_TITLE, body, '/conversations/conv1');
	});

	it('rejects a caller in the wrong role with fail(403) and no writes', async () => {
		const { pb, convUpdate, itemUpdate } = pbForTransition(conversation({ lendingStatus: testCase.validState }));

		const result = await testCase.call(pb, 'conv1', testCase.wrongRoleCallerId);

		expect(result).toMatchObject({ status: 403 });
		expect(convUpdate).not.toHaveBeenCalled();
		expect(itemUpdate).not.toHaveBeenCalled();
		expect(createNotification).not.toHaveBeenCalled();
		expect(sendPushToUser).not.toHaveBeenCalled();
	});

	it('rejects a call from an invalid lending state with fail(400) and no writes', async () => {
		const { pb, convUpdate, itemUpdate } = pbForTransition(conversation({ lendingStatus: testCase.invalidState }));

		const result = await testCase.call(pb, 'conv1', testCase.callerId);

		expect(result).toMatchObject({ status: 400 });
		expect(convUpdate).not.toHaveBeenCalled();
		expect(itemUpdate).not.toHaveBeenCalled();
		expect(createNotification).not.toHaveBeenCalled();
		expect(sendPushToUser).not.toHaveBeenCalled();
	});
});

// Action-specific behavior not covered by the generic table above.

describe('abortRequest (symmetric role)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('lets the OWNER abort an accepted request too, notifying the requester', async () => {
		const { pb, convUpdate, itemUpdate } = pbForTransition(conversation({ lendingStatus: 'accepted' }));

		const result = await abortRequest(pb, 'conv1', OWNER);

		expect(result).toBeUndefined();
		expect(convUpdate).toHaveBeenCalledWith('conv1', { lendingStatus: 'aborted' });
		// The frontend must NOT touch the item — the backend hook frees it.
		expect(itemUpdate).not.toHaveBeenCalled();
		const body = texts.notifications.requestAborted(ITEM_NAME);
		expect(createNotification).toHaveBeenCalledWith(pb, REQUESTER, OWNER, 'request_aborted', 'conv1', body);
	});
});

describe('acceptRequest (auto-reject fan-out)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('auto-rejects other pending conversations for the same item and notifies each requester', async () => {
		const convUpdate = vi.fn().mockResolvedValue(true);
		const itemUpdate = vi.fn().mockResolvedValue(true);
		const getFullList = vi.fn().mockResolvedValue([{ id: 'conv2', requester: 'userC' }, { id: 'conv3', requester: 'userD' }]);
		const pb = makeMockPb({
			conversations: { getOne: vi.fn().mockResolvedValue(conversation({ lendingStatus: 'pending' })), update: convUpdate, getFullList },
			items: { getOne: vi.fn().mockResolvedValue({ id: 'item1', name: ITEM_NAME }), update: itemUpdate },
		});

		await acceptRequest(pb, 'conv1', OWNER);

		expect(getFullList).toHaveBeenCalled();
		expect(convUpdate).toHaveBeenCalledWith('conv2', { lendingStatus: 'rejected' });
		expect(convUpdate).toHaveBeenCalledWith('conv3', { lendingStatus: 'rejected' });
		const rejectedBody = texts.notifications.requestRejected(ITEM_NAME);
		expect(createNotification).toHaveBeenCalledWith(pb, 'userC', OWNER, 'request_rejected', 'conv2', rejectedBody);
		expect(createNotification).toHaveBeenCalledWith(pb, 'userD', OWNER, 'request_rejected', 'conv3', rejectedBody);
	});

	it('does not fail the accept when the auto-reject fan-out itself fails', async () => {
		const convUpdate = vi.fn().mockResolvedValue(true);
		const itemUpdate = vi.fn().mockResolvedValue(true);
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const pb = makeMockPb({
			conversations: {
				getOne: vi.fn().mockResolvedValue(conversation({ lendingStatus: 'pending' })),
				update: convUpdate,
				getFullList: vi.fn().mockRejectedValue(new Error('boom')),
			},
			items: { getOne: vi.fn().mockResolvedValue({ id: 'item1', name: ITEM_NAME }), update: itemUpdate },
		});

		const result = await acceptRequest(pb, 'conv1', OWNER);

		expect(result).toBeUndefined();
		expect(convUpdate).toHaveBeenCalledWith('conv1', { lendingStatus: 'accepted' });
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});
});

describe('confirmReturn (counterfactual)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('also accepts confirming from return_requested (not just active)', async () => {
		const { pb, convUpdate } = pbForTransition(conversation({ lendingStatus: 'return_requested' }));

		const result = await confirmReturn(pb, 'conv1', OWNER);

		expect(result).toBeUndefined();
		expect(convUpdate.mock.calls[0][1]).toMatchObject({ lendingStatus: 'completed' });
	});
});
