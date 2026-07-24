import { describe, it, expect } from 'vitest';
import type { Conversation, Item, User } from '$lib/types/models';
import { toConversationDetail } from './conversationDetail';

function user(overrides: Partial<User> = {}): User {
	return {
		id: 'u1',
		username: 'alice',
		email: 'alice@example.com',
		created: '2025-01-01T00:00:00Z',
		updated: '2025-01-01T00:00:00Z',
		...overrides,
	} as User;
}

function item(overrides: Partial<Item> = {}): Item {
	return {
		id: 'item1',
		name: 'Bohrmaschine',
		created: '2025-01-01T00:00:00Z',
		updated: '2025-01-01T00:00:00Z',
		...overrides,
	} as Item;
}

function conversationRecord(overrides: Partial<Conversation> = {}): Conversation {
	const requester = user({ id: 'userA', username: 'alice' });
	const itemOwner = user({ id: 'userB', username: 'bob' });
	return {
		id: 'conv1',
		requester: requester.id,
		itemOwner: itemOwner.id,
		requestedItem: 'item1',
		messages: [],
		readByRequester: true,
		readByOwner: false,
		created: '2025-01-01T00:00:00Z',
		updated: '2025-01-02T00:00:00Z',
		expand: {
			requester,
			itemOwner,
			requestedItem: item(),
			messages: [],
		},
		...overrides,
	};
}

describe('toConversationDetail', () => {
	it('flattens a fully-expanded conversation record', () => {
		const detail = toConversationDetail(conversationRecord());

		expect(detail).toMatchObject({
			id: 'conv1',
			requester: { id: 'userA', username: 'alice' },
			itemOwner: { id: 'userB', username: 'bob' },
			requestedItem: { id: 'item1', name: 'Bohrmaschine' },
			messages: [],
			readByRequester: true,
			readByOwner: false,
		});
	});

	it('maps a dangling/missing requestedItem to null instead of crashing', () => {
		const record = conversationRecord({
			expand: {
				requester: user({ id: 'userA' }),
				itemOwner: user({ id: 'userB' }),
				// requestedItem intentionally omitted — simulates a deleted/inaccessible item.
				messages: [],
			},
		});

		const detail = toConversationDetail(record);

		expect(detail.requestedItem).toBeNull();
	});

	it('throws if requester/itemOwner were not expanded', () => {
		const record = conversationRecord({ expand: { requester: undefined, itemOwner: undefined } });

		expect(() => toConversationDetail(record)).toThrow();
	});

	it('defaults messages to an empty array when the expand is missing', () => {
		const record = conversationRecord({
			expand: { requester: user({ id: 'userA' }), itemOwner: user({ id: 'userB' }) },
		});

		expect(toConversationDetail(record).messages).toEqual([]);
	});
});
