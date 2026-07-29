import { describe, it, expect, vi } from 'vitest';
import { conversationFieldsWithSafePartners } from '$lib/conversationPartnerFields';
import { makeMockPb } from '$lib/test-utils/pocketbase';

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

import { load } from './+page.server';

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
});
