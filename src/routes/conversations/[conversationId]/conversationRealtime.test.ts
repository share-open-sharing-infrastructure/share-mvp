import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RecordSubscription } from 'pocketbase';
import type { Conversation, Message } from '$lib/types/models';
import { makeMockPb } from '$lib/test-utils/pocketbase';

// Capture the options passed to subscribeRealtime so tests can fire synthetic
// events at the registered handler. The real client-pb pulls in $env/static/public
// and opens an EventSource — neither is wanted here, so the whole module is mocked.
const { subscribeRealtime, unsubscribe } = vi.hoisted(() => ({
	subscribeRealtime: vi.fn(),
	unsubscribe: vi.fn(),
}));

vi.mock('$lib/realtime', () => ({ subscribeRealtime }));

import { subscribeConversation } from './conversationRealtime';

type Handler = (event: RecordSubscription<Conversation>) => void | Promise<void>;

/** Reads the handler that the helper registered with subscribeRealtime. */
function registeredHandler(): Handler {
	expect(subscribeRealtime).toHaveBeenCalledTimes(1);
	return subscribeRealtime.mock.calls[0][0].handler as Handler;
}

/** Minimal realtime `update` event carrying a raw conversation record. */
function updateEvent(record: Record<string, unknown>): RecordSubscription<Conversation> {
	return { action: 'update', record } as unknown as RecordSubscription<Conversation>;
}

function msg(id: string): Message {
	return { id, messageContent: `content-${id}` } as Message;
}

/** Backing state + accessors, mirroring how the page wires realtimeSynced boxes. */
function makeState(initialMessages: Message[] = []) {
	let messages = initialMessages;
	const setLendingStatus = vi.fn<(s: Conversation['lendingStatus']) => void>();
	const setCounterfactual = vi.fn<(c: Conversation['counterfactual']) => void>();
	const setMessages = vi.fn((next: Message[]) => {
		messages = next;
	});
	return {
		accessors: {
			getMessages: () => messages,
			setMessages,
			setLendingStatus,
			setCounterfactual,
		},
		get messages() {
			return messages;
		},
		setMessages,
		setLendingStatus,
		setCounterfactual,
	};
}

/** A fake PocketBase whose `messages` collection getOne is scriptable. */
function makePb(getOne: ReturnType<typeof vi.fn>) {
	return makeMockPb({ messages: { getOne } });
}

beforeEach(() => {
	vi.clearAllMocks();
	subscribeRealtime.mockReturnValue(unsubscribe);
});

describe('subscribeConversation', () => {
	it('wires the subscription to the conversation record and returns the unsubscribe fn', () => {
		const state = makeState();
		const onReconnect = vi.fn();
		const cleanup = subscribeConversation(makePb(vi.fn()), 'conv1', state.accessors, onReconnect);

		expect(subscribeRealtime).toHaveBeenCalledTimes(1);
		const opts = subscribeRealtime.mock.calls[0][0];
		expect(opts.collection).toBe('conversations');
		expect(opts.topic).toBe('conv1');
		expect(opts.onReconnect).toBe(onReconnect);
		expect(cleanup).toBe(unsubscribe);
	});

	it('fetches and appends the message when the last id is new (case 1)', async () => {
		const state = makeState([msg('m1')]);
		const getOne = vi.fn().mockResolvedValue(msg('m2'));
		subscribeConversation(makePb(getOne), 'conv1', state.accessors);

		await registeredHandler()(updateEvent({ messages: ['m1', 'm2'] }));

		expect(getOne).toHaveBeenCalledWith('m2');
		expect(state.setMessages).toHaveBeenCalledTimes(1);
		expect(state.messages).toEqual([msg('m1'), msg('m2')]);
	});

	it('fetches and appends ALL new ids from a coalesced/batched event, not just the last one', async () => {
		const state = makeState([msg('m1')]);
		const getOne = vi.fn().mockImplementation(async (id: string) => msg(id));
		subscribeConversation(makePb(getOne), 'conv1', state.accessors);

		await registeredHandler()(updateEvent({ messages: ['m1', 'm2', 'm3'] }));

		expect(getOne).toHaveBeenCalledWith('m2');
		expect(getOne).toHaveBeenCalledWith('m3');
		expect(getOne).toHaveBeenCalledTimes(2);
		expect(state.setMessages).toHaveBeenCalledTimes(1);
		// Order preserved: earlier message in the batch is not dropped or reordered.
		expect(state.messages).toEqual([msg('m1'), msg('m2'), msg('m3')]);
	});

	it('skips the fetch when the last message id is already present (case 2)', async () => {
		const state = makeState([msg('m1')]);
		const getOne = vi.fn();
		subscribeConversation(makePb(getOne), 'conv1', state.accessors);

		await registeredHandler()(updateEvent({ messages: ['m1'] }));

		expect(getOne).not.toHaveBeenCalled();
		expect(state.setMessages).not.toHaveBeenCalled();
	});

	it('does not double-append when the message arrived during the fetch (case 3)', async () => {
		const state = makeState([msg('m1')]);
		// Simulate a use:enhance reload adding m2 while getOne is in flight.
		const getOne = vi.fn().mockImplementation(async () => {
			state.setMessages([msg('m1'), msg('m2')]);
			return msg('m2');
		});
		subscribeConversation(makePb(getOne), 'conv1', state.accessors);

		await registeredHandler()(updateEvent({ messages: ['m1', 'm2'] }));

		expect(getOne).toHaveBeenCalledWith('m2');
		// setMessages ran once (from the reload simulation), not again from the handler.
		expect(state.setMessages).toHaveBeenCalledTimes(1);
		expect(state.messages.filter((m) => m.id === 'm2')).toHaveLength(1);
	});

	it('does nothing for a missing or empty messages field (case 4)', async () => {
		const getOne = vi.fn();

		const stateMissing = makeState([msg('m1')]);
		subscribeConversation(makePb(getOne), 'conv1', stateMissing.accessors);
		await registeredHandler()(updateEvent({}));
		expect(getOne).not.toHaveBeenCalled();
		expect(stateMissing.setMessages).not.toHaveBeenCalled();

		vi.clearAllMocks();
		subscribeRealtime.mockReturnValue(unsubscribe);

		const stateEmpty = makeState([msg('m1')]);
		subscribeConversation(makePb(getOne), 'conv1', stateEmpty.accessors);
		await registeredHandler()(updateEvent({ messages: [] }));
		expect(getOne).not.toHaveBeenCalled();
		expect(stateEmpty.setMessages).not.toHaveBeenCalled();
	});

	it('sets lendingStatus/counterfactual only when present, mapping "" to undefined (case 5)', async () => {
		// Present, non-empty → set through.
		const s1 = makeState();
		subscribeConversation(makePb(vi.fn()), 'conv1', s1.accessors);
		await registeredHandler()(updateEvent({ lendingStatus: 'accepted', counterfactual: 'would_buy' }));
		expect(s1.setLendingStatus).toHaveBeenCalledWith('accepted');
		expect(s1.setCounterfactual).toHaveBeenCalledWith('would_buy');

		vi.clearAllMocks();
		subscribeRealtime.mockReturnValue(unsubscribe);

		// Present but empty string → undefined.
		const s2 = makeState();
		subscribeConversation(makePb(vi.fn()), 'conv1', s2.accessors);
		await registeredHandler()(updateEvent({ lendingStatus: '', counterfactual: '' }));
		expect(s2.setLendingStatus).toHaveBeenCalledWith(undefined);
		expect(s2.setCounterfactual).toHaveBeenCalledWith(undefined);

		vi.clearAllMocks();
		subscribeRealtime.mockReturnValue(unsubscribe);

		// Field absent → not touched.
		const s3 = makeState();
		subscribeConversation(makePb(vi.fn()), 'conv1', s3.accessors);
		await registeredHandler()(updateEvent({ messages: [] }));
		expect(s3.setLendingStatus).not.toHaveBeenCalled();
		expect(s3.setCounterfactual).not.toHaveBeenCalled();
	});

	it('logs and leaves state unchanged when the fetch rejects (case 6)', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const state = makeState([msg('m1')]);
		const getOne = vi.fn().mockRejectedValue(new Error('boom'));
		subscribeConversation(makePb(getOne), 'conv1', state.accessors);

		// Must not throw / reject (no unhandled rejection).
		await expect(registeredHandler()(updateEvent({ messages: ['m1', 'm2'] }))).resolves.toBeUndefined();

		expect(getOne).toHaveBeenCalledWith('m2');
		expect(state.setMessages).not.toHaveBeenCalled();
		expect(state.messages).toEqual([msg('m1')]);
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});

	it('ignores non-update events (case 7)', async () => {
		const state = makeState([msg('m1')]);
		const getOne = vi.fn();
		subscribeConversation(makePb(getOne), 'conv1', state.accessors);

		const handler = registeredHandler();
		for (const action of ['create', 'delete'] as const) {
			await handler({ action, record: { messages: ['m1', 'm2'], lendingStatus: 'accepted' } } as unknown as RecordSubscription<Conversation>);
		}

		expect(getOne).not.toHaveBeenCalled();
		expect(state.setMessages).not.toHaveBeenCalled();
		expect(state.setLendingStatus).not.toHaveBeenCalled();
		expect(state.setCounterfactual).not.toHaveBeenCalled();
	});
});
