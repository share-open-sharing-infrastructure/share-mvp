import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RecordSubscription } from 'pocketbase';
import type { Conversation } from '$lib/types/models';
import { makeMockPb } from '$lib/test-utils/pocketbase';
import { conversationFieldsWithSafePartners } from '$lib/conversationPartnerFields';

const { subscribeRealtime, unsubscribe } = vi.hoisted(() => ({
	subscribeRealtime: vi.fn(),
	unsubscribe: vi.fn(),
}));

vi.mock('$lib/realtime', () => ({ subscribeRealtime }));

import { subscribeConversationList } from './conversationListRealtime';

type Handler = (event: RecordSubscription<Conversation>) => void | Promise<void>;

function registeredHandler(): Handler {
	expect(subscribeRealtime).toHaveBeenCalledTimes(1);
	return subscribeRealtime.mock.calls[0][0].handler as Handler;
}

function conv(overrides: Partial<Conversation> = {}): Conversation {
	return {
		id: 'c1',
		requester: 'userA',
		itemOwner: 'userB',
		requestedItem: 'item1',
		messages: [],
		readByRequester: true,
		readByOwner: true,
		lastMessageAt: '',
		created: '2025-01-01T00:00:00Z',
		updated: '2025-01-01T00:00:00Z',
		...overrides,
	} as Conversation;
}

/** Backing state + accessors mirroring how the layout wires this helper's list. */
function makeState(initial: Conversation[] = []) {
	let list = initial;
	const setList = vi.fn((next: Conversation[]) => {
		list = next;
	});
	return {
		getList: () => list,
		setList,
		get list() {
			return list;
		},
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	subscribeRealtime.mockReturnValue(unsubscribe);
});

describe('subscribeConversationList', () => {
	it('wires the subscription to the "*" topic and returns the unsubscribe fn', () => {
		const state = makeState();
		const onReconnect = vi.fn();
		const cleanup = subscribeConversationList(makeMockPb({}), state.getList, state.setList, onReconnect);

		expect(subscribeRealtime).toHaveBeenCalledTimes(1);
		const opts = subscribeRealtime.mock.calls[0][0];
		expect(opts.collection).toBe('conversations');
		expect(opts.topic).toBe('*');
		expect(opts.onReconnect).toBe(onReconnect);
		expect(cleanup).toBe(unsubscribe);
	});

	describe('update events', () => {
		it('syncs readByOwner/readByRequester, lastMessageAt and lendingStatus', async () => {
			const state = makeState([conv({ id: 'c1', readByOwner: false, lastMessageAt: '2025-01-01T00:00:00Z' })]);
			subscribeConversationList(makeMockPb({}), state.getList, state.setList);

			await registeredHandler()({
				action: 'update',
				record: {
					id: 'c1',
					readByOwner: true,
					readByRequester: false,
					lastMessageAt: '2025-01-02T00:00:00Z',
					lendingStatus: 'accepted',
				},
			} as unknown as RecordSubscription<Conversation>);

			expect(state.list).toEqual([
				expect.objectContaining({
					id: 'c1',
					readByOwner: true,
					readByRequester: false,
					lastMessageAt: '2025-01-02T00:00:00Z',
					lendingStatus: 'accepted',
				}),
			]);
		});

		it('re-sorts the list by the new lastMessageAt (descending)', async () => {
			const older = conv({ id: 'older', lastMessageAt: '2025-01-01T00:00:00Z' });
			const newer = conv({ id: 'newer', lastMessageAt: '2025-01-05T00:00:00Z' });
			const state = makeState([newer, older]);
			subscribeConversationList(makeMockPb({}), state.getList, state.setList);

			// 'older' just received a brand-new message, making it the most recent.
			await registeredHandler()({
				action: 'update',
				record: { id: 'older', readByOwner: true, readByRequester: true, lastMessageAt: '2025-01-10T00:00:00Z' },
			} as unknown as RecordSubscription<Conversation>);

			expect(state.list.map((c) => c.id)).toEqual(['older', 'newer']);
		});

		it('leaves the list untouched when the updated conversation is not present', async () => {
			const state = makeState([conv({ id: 'c1' })]);
			subscribeConversationList(makeMockPb({}), state.getList, state.setList);

			await registeredHandler()({
				action: 'update',
				record: { id: 'unknown', readByOwner: true, readByRequester: true, lastMessageAt: '' },
			} as unknown as RecordSubscription<Conversation>);

			expect(state.list.map((c) => c.id)).toEqual(['c1']);
		});
	});

	describe('create events', () => {
		it('inserts a fetched record respecting the sort order (not just appending)', async () => {
			const older = conv({ id: 'older', lastMessageAt: '2025-01-01T00:00:00Z' });
			const newest = conv({ id: 'newest', lastMessageAt: '2025-01-20T00:00:00Z' });
			const state = makeState([older]);
			const getOne = vi.fn().mockResolvedValue(newest);
			const pb = makeMockPb({ conversations: { getOne } });
			subscribeConversationList(pb, state.getList, state.setList);

			await registeredHandler()({ action: 'create', record: { id: 'newest' } } as unknown as RecordSubscription<Conversation>);

			expect(getOne).toHaveBeenCalledWith('newest', {
				expand: 'requester,itemOwner,requestedItem',
				fields: conversationFieldsWithSafePartners('*,expand.requestedItem.*'),
			});
			expect(state.list.map((c) => c.id)).toEqual(['newest', 'older']);
		});

		it('skips the fetch and does not duplicate when the id is already present', async () => {
			const state = makeState([conv({ id: 'c1' })]);
			const getOne = vi.fn();
			subscribeConversationList(makeMockPb({ conversations: { getOne } }), state.getList, state.setList);

			await registeredHandler()({ action: 'create', record: { id: 'c1' } } as unknown as RecordSubscription<Conversation>);

			expect(getOne).not.toHaveBeenCalled();
			expect(state.setList).not.toHaveBeenCalled();
		});

		it('silently ignores a fetch failure (record deleted before it could be fetched)', async () => {
			const state = makeState([]);
			const getOne = vi.fn().mockRejectedValue(new Error('not found'));
			subscribeConversationList(makeMockPb({ conversations: { getOne } }), state.getList, state.setList);

			await expect(
				registeredHandler()({ action: 'create', record: { id: 'gone' } } as unknown as RecordSubscription<Conversation>)
			).resolves.toBeUndefined();
			expect(state.setList).not.toHaveBeenCalled();
		});
	});

	describe('delete events', () => {
		it('removes the deleted conversation from the list', async () => {
			const state = makeState([conv({ id: 'c1' }), conv({ id: 'c2' })]);
			subscribeConversationList(makeMockPb({}), state.getList, state.setList);

			await registeredHandler()({ action: 'delete', record: { id: 'c1' } } as unknown as RecordSubscription<Conversation>);

			expect(state.list.map((c) => c.id)).toEqual(['c2']);
		});

		it('is a no-op when the deleted id is not in the list', async () => {
			const state = makeState([conv({ id: 'c1' })]);
			subscribeConversationList(makeMockPb({}), state.getList, state.setList);

			await registeredHandler()({ action: 'delete', record: { id: 'unknown' } } as unknown as RecordSubscription<Conversation>);

			expect(state.list.map((c) => c.id)).toEqual(['c1']);
		});
	});
});
