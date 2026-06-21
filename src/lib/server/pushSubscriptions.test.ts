import { describe, it, expect, vi } from 'vitest';
import type PocketBase from 'pocketbase';
import {
	upsertPushSubscription,
	deletePushSubscription,
	deleteAllPushSubscriptions,
} from './pushSubscriptions';

function mockFilter(raw: string, params?: Record<string, unknown>): string {
	if (!params) return raw;
	let result = raw;
	for (const [key, value] of Object.entries(params)) {
		const escaped = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : `${value}`;
		result = result.replaceAll(`{:${key}}`, escaped);
	}
	return result;
}

type Stub = Record<string, ReturnType<typeof vi.fn>>;

function makeMockPb(stub: Stub): { pb: PocketBase; filter: ReturnType<typeof vi.fn> } {
	const filter = vi.fn(mockFilter);
	const pb = { collection: vi.fn(() => stub), filter } as unknown as PocketBase;
	return { pb, filter };
}

const payload = { endpoint: 'https://push.example/abc', keys: { p256dh: 'P', auth: 'A' } };

describe('upsertPushSubscription', () => {
	it('reassigns an already-registered endpoint to the new user and refreshes keys', async () => {
		const stub: Stub = {
			getList: vi.fn().mockResolvedValue({ items: [{ id: 'sub1' }] }),
			update: vi.fn().mockResolvedValue({}),
			create: vi.fn(),
		};
		const { pb, filter } = makeMockPb(stub);
		await upsertPushSubscription(pb, 'userB', payload);
		// Lookup is by endpoint only — intentional: an endpoint is reassigned to whoever
		// last registered it. The filter must be parameterized (no injection).
		expect(filter).toHaveBeenCalledWith('endpoint={:endpoint}', {
			endpoint: 'https://push.example/abc',
		});
		expect(stub.update).toHaveBeenCalledWith('sub1', { user: 'userB', p256dh: 'P', auth: 'A' });
		expect(stub.create).not.toHaveBeenCalled();
	});

	it('creates a new record when the endpoint is unknown', async () => {
		const stub: Stub = {
			getList: vi.fn().mockResolvedValue({ items: [] }),
			update: vi.fn(),
			create: vi.fn().mockResolvedValue({}),
		};
		const { pb } = makeMockPb(stub);
		await upsertPushSubscription(pb, 'userA', payload);
		expect(stub.create).toHaveBeenCalledWith({
			user: 'userA',
			endpoint: 'https://push.example/abc',
			p256dh: 'P',
			auth: 'A',
		});
		expect(stub.update).not.toHaveBeenCalled();
	});

	it('treats a failed lookup as "not found" and creates instead of throwing', async () => {
		const stub: Stub = {
			getList: vi.fn().mockRejectedValue(new Error('db down')),
			update: vi.fn(),
			create: vi.fn().mockResolvedValue({}),
		};
		const { pb } = makeMockPb(stub);
		await expect(upsertPushSubscription(pb, 'userA', payload)).resolves.toBeUndefined();
		expect(stub.create).toHaveBeenCalled();
	});
});

describe('deletePushSubscription', () => {
	it('deletes the matching record, scoped to BOTH endpoint and the caller’s user id', async () => {
		const stub: Stub = {
			getList: vi.fn().mockResolvedValue({ items: [{ id: 'sub1' }] }),
			delete: vi.fn().mockResolvedValue(true),
		};
		const { pb, filter } = makeMockPb(stub);
		await deletePushSubscription(pb, 'userA', 'https://push.example/abc');
		expect(stub.delete).toHaveBeenCalledWith('sub1');
		// The user filter is what prevents removing another user's subscription.
		expect(filter).toHaveBeenCalledWith(
			expect.stringContaining('user='),
			expect.objectContaining({ endpoint: 'https://push.example/abc', userId: 'userA' })
		);
	});

	it('no-ops when no matching record exists', async () => {
		const stub: Stub = {
			getList: vi.fn().mockResolvedValue({ items: [] }),
			delete: vi.fn(),
		};
		const { pb } = makeMockPb(stub);
		await deletePushSubscription(pb, 'userA', 'https://push.example/abc');
		expect(stub.delete).not.toHaveBeenCalled();
	});

	it('swallows a failed lookup and neither throws nor deletes', async () => {
		const stub: Stub = {
			getList: vi.fn().mockRejectedValue(new Error('db down')),
			delete: vi.fn(),
		};
		const { pb } = makeMockPb(stub);
		await expect(
			deletePushSubscription(pb, 'userA', 'https://push.example/abc')
		).resolves.toBeUndefined();
		expect(stub.delete).not.toHaveBeenCalled();
	});
});

describe('deleteAllPushSubscriptions', () => {
	it('deletes every subscription belonging to the user', async () => {
		const stub: Stub = {
			getFullList: vi.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }]),
			delete: vi.fn().mockResolvedValue(true),
		};
		const { pb } = makeMockPb(stub);
		await deleteAllPushSubscriptions(pb, 'userA');
		expect(stub.delete).toHaveBeenCalledTimes(2);
		expect(stub.delete).toHaveBeenCalledWith('s1');
		expect(stub.delete).toHaveBeenCalledWith('s2');
	});
});
