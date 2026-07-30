import { describe, it, expect, vi, beforeEach } from 'vitest';
import { conversationFieldsWithSafePartners } from '$lib/conversationPartnerFields';
import { makeMockPb } from '$lib/test-utils/pocketbase';
import { texts } from '$lib/texts';

// Avoid loading the real notifications module (web-push + VAPID env) at import time —
// pulled in transitively via ./lending.server.js and ./conversation.server.js.
vi.mock('$lib/server/notifications.js', () => ({
	createNotification: vi.fn(),
	sendPushToUser: vi.fn(),
	isMessageNotificationThrottled: vi.fn(),
	notifyAndPush: vi.fn(),
}));

// Contact resolution is exercised by its own suite; stub it here so `load()` doesn't need a
// real `user_contacts` collection wired into the mock pb.
vi.mock('$lib/server/contacts', () => ({
	fetchPartnerContact: vi.fn().mockResolvedValue(null),
}));

import { load, actions } from './+page.server';

const REQUESTER = 'userA';
const OWNER = 'userB';

function conversationRecord(overrides: Record<string, unknown> = {}) {
	return {
		id: 'conv1',
		requester: REQUESTER,
		itemOwner: OWNER,
		requestedItem: 'item1',
		lendingStatus: 'pending',
		readByRequester: true,
		readByOwner: true,
		created: '2026-01-01',
		updated: '2026-01-01',
		expand: {
			requester: { id: REQUESTER, username: 'requesterName', deleted: false },
			itemOwner: { id: OWNER, username: 'ownerName', deleted: false },
			requestedItem: { id: 'item1', name: 'Bohrmaschine' },
			messages: [],
		},
		...overrides,
	};
}

describe('conversations/[conversationId] load()', () => {
	it("requests the requester/itemOwner expand restricted to conversationFieldsWithSafePartners' safe subset (never email)", async () => {
		const getOne = vi.fn().mockResolvedValue(conversationRecord());
		const pb = makeMockPb({
			conversations: { getOne, update: vi.fn() },
			notifications: { getFullList: vi.fn().mockResolvedValue([]) },
		});

		await load({
			params: { conversationId: 'conv1' },
			locals: { pb, user: { id: REQUESTER } },
		} as unknown as Parameters<typeof load>[0]);

		expect(getOne).toHaveBeenCalledWith(
			'conv1',
			expect.objectContaining({
				fields: conversationFieldsWithSafePartners('*,expand.requestedItem.*,expand.messages.*'),
			})
		);
		// Belt-and-suspenders: whatever the fields builder produces, this call site must
		// never end up requesting the partners' `email` field.
		const requestedFields = getOne.mock.calls[0][1].fields as string;
		expect(requestedFields).not.toMatch(/email/i);
	});

	it('does NOT mutate read-state — regression for the hover-preload bug (#412)', async () => {
		// The viewer is the requester and the thread is unread for them: the old load() flipped
		// readByRequester right here, so a mere hover (app.html sets
		// data-sveltekit-preload-data="hover", which runs load()) marked the thread read.
		// Read-marking now happens exclusively in the markRead action below.
		const update = vi.fn();
		const notifUpdate = vi.fn();
		const pb = makeMockPb({
			conversations: {
				getOne: vi.fn().mockResolvedValue(conversationRecord({ readByRequester: false })),
				update,
			},
			notifications: { getFullList: vi.fn().mockResolvedValue([{ id: 'n1' }]), update: notifUpdate },
		});

		const data = await load({
			params: { conversationId: 'conv1' },
			locals: { pb, user: { id: REQUESTER } },
		} as unknown as Parameters<typeof load>[0]);

		expect(update).not.toHaveBeenCalled();
		// Nor may it clear the thread's notifications — the other half of read-state.
		expect(notifUpdate).not.toHaveBeenCalled();
		expect(data.conversation.id).toBe('conv1');
	});
});

describe('conversations/[conversationId] markRead action', () => {
	beforeEach(() => vi.clearAllMocks());

	/** Builds an action event plus handles on the mocked collection methods. */
	function makeEvent(
		user: { id: string } | null,
		record: Record<string, unknown> = conversationRecord()
	) {
		const getOne = vi.fn().mockResolvedValue(record);
		const update = vi.fn().mockResolvedValue(true);
		const notifUpdate = vi.fn().mockResolvedValue(true);
		const pb = makeMockPb({
			conversations: { getOne, update },
			notifications: { getFullList: vi.fn().mockResolvedValue([]), update: notifUpdate },
		});
		const event = {
			params: { conversationId: 'conv1' },
			locals: { pb, user },
		} as unknown as Parameters<typeof actions.markRead>[0];
		return { event, getOne, update, notifUpdate };
	}

	it('fails 401 when unauthenticated', async () => {
		const { event, getOne, update } = makeEvent(null);

		const result = await actions.markRead(event);

		expect(result).toMatchObject({ status: 401, data: { message: texts.errors.noPermission } });
		expect(getOne).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it('fails 403 for a non-participant and writes nothing', async () => {
		const { event, update, notifUpdate } = makeEvent({ id: 'intruder' });

		const result = await actions.markRead(event);

		expect(result).toMatchObject({ status: 403, data: { message: texts.errors.noPermission } });
		expect(update).not.toHaveBeenCalled();
		expect(notifUpdate).not.toHaveBeenCalled();
	});

	it('marks the thread read for the viewer, fetching the record once with the read flags', async () => {
		const { event, getOne, update } = makeEvent(
			{ id: OWNER },
			conversationRecord({ readByRequester: true, readByOwner: false })
		);

		const result = await actions.markRead(event);

		expect(result).toBeUndefined();
		// One getOne that both authorises and supplies the flags markConversationRead needs.
		expect(getOne).toHaveBeenCalledTimes(1);
		expect(getOne).toHaveBeenCalledWith('conv1', {
			fields: 'id,requester,itemOwner,readByRequester,readByOwner',
		});
		expect(update).toHaveBeenCalledWith('conv1', { readByOwner: true });
	});

	it("propagates PocketBase's status when the conversation cannot be fetched", async () => {
		const getOne = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { status: 404 }));
		const update = vi.fn();
		const pb = makeMockPb({
			conversations: { getOne, update },
			notifications: { getFullList: vi.fn().mockResolvedValue([]), update: vi.fn() },
		});

		const result = await actions.markRead({
			params: { conversationId: 'conv1' },
			locals: { pb, user: { id: OWNER } },
		} as unknown as Parameters<typeof actions.markRead>[0]);

		expect(result).toMatchObject({ status: 404 });
		expect(update).not.toHaveBeenCalled();
	});
});
