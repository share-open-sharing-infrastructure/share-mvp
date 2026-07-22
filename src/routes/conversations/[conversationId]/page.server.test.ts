import { describe, it, expect, vi, beforeEach } from 'vitest';

// +page.server reads PUBLIC_PB_URL at import time.
vi.mock('$env/static/public', () => ({
	PUBLIC_PB_URL: 'http://localhost/',
	PUBLIC_VAPID_PUBLIC_KEY: 'x',
}));
// Partner contact resolution is exercised by its own suite; stub it.
vi.mock('$lib/server/contacts', () => ({ fetchPartnerContact: vi.fn(async () => null) }));
// Lending-flow action helpers have their own suite; stub the whole module.
vi.mock('./lending.server.js', () => ({
	acceptRequest: vi.fn(),
	rejectRequest: vi.fn(),
	abortRequest: vi.fn(),
	confirmHandover: vi.fn(),
	requestReturn: vi.fn(),
	confirmReturn: vi.fn(),
}));
// Messaging helpers — spy on the participant-fetch + markConversationRead; the others are
// unused here. NotParticipantError must be a real class so the action's `instanceof` check works.
const { markConversationRead, fetchConversationForParticipant, NotParticipantError, toActionFailResult } =
	vi.hoisted(() => {
		class NotParticipantError extends Error {}
		return {
			markConversationRead: vi.fn(),
			fetchConversationForParticipant: vi.fn(),
			NotParticipantError,
			toActionFailResult: vi.fn(),
		};
	});
vi.mock('./conversation.server.js', () => ({
	markConversationRead,
	fetchConversationForParticipant,
	NotParticipantError,
	toActionFailResult,
	sendMessage: vi.fn(),
	toggleItemStatus: vi.fn(),
	deleteConversation: vi.fn(),
}));

import { fail } from '@sveltejs/kit';
import { load, actions } from './+page.server';
import { texts } from '$lib/texts';

// Faithful stand-in for the real helper (its module is mocked above): translate a
// NotParticipantError to fail(403, …) via the mock's own class, everything else to the
// caller-supplied fallback message. Mirrors conversation.server.ts#toActionFailResult.
toActionFailResult.mockImplementation((err: unknown, fallbackMessage: string) => {
	if (err instanceof NotParticipantError) {
		return fail(403, { fail: true, message: texts.errors.noPermission });
	}
	const status = (err as { status?: number })?.status ?? 500;
	return fail(status, { fail: true, message: fallbackMessage });
});

const REQUESTER_ID = 'userA';
const OWNER_ID = 'userB';
const CONV_ID = 'conv1';

/** A conversation record as returned by conversations.getOne (unread for the requester). */
function convRecord(extra: Record<string, unknown> = {}) {
	return {
		id: CONV_ID,
		requester: REQUESTER_ID,
		itemOwner: OWNER_ID,
		readByRequester: false,
		readByOwner: true,
		expand: {
			requester: { id: REQUESTER_ID },
			itemOwner: { id: OWNER_ID },
			requestedItem: { id: 'item1', name: 'Bohrmaschine' },
			messages: [],
		},
		...extra,
	};
}

function makeEvent(opts: {
	user: Record<string, unknown> | null;
	getOne?: ReturnType<typeof vi.fn>;
}) {
	const getOne = opts.getOne ?? vi.fn(async () => convRecord());
	const update = vi.fn(async () => ({}));
	const getFullList = vi.fn(async () => []);
	const pb = {
		collection: vi.fn(() => ({ getOne, update, getFullList })),
		filter: vi.fn((raw: string) => raw),
	};
	return {
		locals: { pb, user: opts.user },
		params: { conversationId: CONV_ID },
		request: { formData: async () => new FormData() },
		__pb: pb,
		__update: update,
	} as unknown as Parameters<typeof load>[0] & {
		__pb: typeof pb;
		__update: ReturnType<typeof vi.fn>;
	};
}

const asAction = (e: ReturnType<typeof makeEvent>) => e as unknown as Parameters<typeof actions.markRead>[0];
const updateOf = (e: ReturnType<typeof makeEvent>) => e.__update;

beforeEach(() => {
	markConversationRead.mockClear();
	fetchConversationForParticipant.mockReset();
});

describe('load', () => {
	it('does NOT mutate read-state (no conversations.update) — regression for hover-preload #412', async () => {
		// The viewer is the requester and the thread is unread for them; the old code
		// would have flipped readByRequester here. load() must now leave it untouched.
		const event = makeEvent({ user: { id: REQUESTER_ID } });
		const data = await load(event);

		expect(updateOf(event)).not.toHaveBeenCalled();
		expect(markConversationRead).not.toHaveBeenCalled();
		expect(data.conversation.id).toBe(CONV_ID);
	});
});

describe('markRead action', () => {
	it('fails 401 when unauthenticated', async () => {
		const event = makeEvent({ user: null });
		const result = await actions.markRead(asAction(event));
		expect(result).toMatchObject({ status: 401, data: { message: texts.errors.noPermission } });
		expect(fetchConversationForParticipant).not.toHaveBeenCalled();
		expect(markConversationRead).not.toHaveBeenCalled();
	});

	it('fails 403 for a non-participant', async () => {
		const event = makeEvent({ user: { id: 'intruder' } });
		fetchConversationForParticipant.mockRejectedValueOnce(new NotParticipantError());
		const result = await actions.markRead(asAction(event));
		expect(result).toMatchObject({ status: 403, data: { message: texts.errors.noPermission } });
		expect(markConversationRead).not.toHaveBeenCalled();
	});

	it('fetches the conversation once and hands the record to the helper (happy path)', async () => {
		const record = {
			id: CONV_ID,
			requester: REQUESTER_ID,
			itemOwner: OWNER_ID,
			readByRequester: true,
			readByOwner: false,
		};
		const event = makeEvent({ user: { id: OWNER_ID } });
		fetchConversationForParticipant.mockResolvedValueOnce(record);
		const result = await actions.markRead(asAction(event));
		expect(result).toBeUndefined();
		// Authorised + fetched exactly once, requesting the read flags as extra fields.
		expect(fetchConversationForParticipant).toHaveBeenCalledTimes(1);
		expect(fetchConversationForParticipant).toHaveBeenCalledWith(
			event.__pb,
			CONV_ID,
			OWNER_ID,
			'readByRequester,readByOwner'
		);
		// The already-fetched record is passed on — no re-fetch inside markConversationRead.
		expect(markConversationRead).toHaveBeenCalledWith(event.__pb, record, OWNER_ID);
	});
});
