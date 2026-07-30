import { describe, it, expect, vi, beforeEach } from 'vitest';
import type PocketBase from 'pocketbase';
import { texts } from '$lib/texts';
import {
	isTrusting,
	addTrust,
	addTrustAndNotify,
	removeTrust,
	getTrustees,
	getTrusters,
	getTrustDirections,
} from './trust';

vi.mock('$lib/server/notifications', () => ({
	createNotification: vi.fn().mockResolvedValue(undefined),
	sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

import { createNotification, sendPushToUser } from '$lib/server/notifications';

function mockFilter(raw: string, params?: Record<string, unknown>): string {
	if (!params) return raw;
	let result = raw;
	for (const [key, value] of Object.entries(params)) {
		const escaped = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : `${value}`;
		result = result.replaceAll(`{:${key}}`, escaped);
	}
	return result;
}

/** Build a pb whose `trusts` collection uses the provided method mocks. */
function makePb(trusts: Record<string, ReturnType<typeof vi.fn>>): PocketBase {
	return {
		collection: vi.fn((name: string) => (name === 'trusts' ? trusts : {})),
		filter: vi.fn(mockFilter),
	} as unknown as PocketBase;
}

describe('isTrusting', () => {
	it('is true when a matching edge exists', async () => {
		const getFirstListItem = vi.fn().mockResolvedValue({ id: 't1' });
		const pb = makePb({ getFirstListItem });
		expect(await isTrusting(pb, 'a', 'b')).toBe(true);
		expect(getFirstListItem).toHaveBeenCalledWith("truster = 'a' && trustee = 'b'", { fields: 'id' });
	});

	it('is false when no edge exists', async () => {
		const pb = makePb({ getFirstListItem: vi.fn().mockRejectedValue(new Error('none')) });
		expect(await isTrusting(pb, 'a', 'b')).toBe(false);
	});
});

describe('addTrust', () => {
	it('creates an edge when none exists', async () => {
		const create = vi.fn().mockResolvedValue({ id: 't1' });
		const pb = makePb({ getFirstListItem: vi.fn().mockRejectedValue(new Error('none')), create });
		await addTrust(pb, 'a', 'b');
		expect(create).toHaveBeenCalledWith({ truster: 'a', trustee: 'b' });
	});

	it('is a no-op when the edge already exists (idempotent)', async () => {
		const create = vi.fn();
		const pb = makePb({ getFirstListItem: vi.fn().mockResolvedValue({ id: 't1' }), create });
		await addTrust(pb, 'a', 'b');
		expect(create).not.toHaveBeenCalled();
	});

	it('never creates a self-trust edge', async () => {
		const create = vi.fn();
		const getFirstListItem = vi.fn();
		const pb = makePb({ getFirstListItem, create });
		await addTrust(pb, 'a', 'a');
		expect(create).not.toHaveBeenCalled();
		expect(getFirstListItem).not.toHaveBeenCalled();
	});

	it('tolerates a concurrent duplicate: create rejects but the edge now exists → no throw', async () => {
		// isTrusting: false up front (pre-check), then true on the post-failure re-check.
		const getFirstListItem = vi
			.fn()
			.mockRejectedValueOnce(new Error('none'))
			.mockResolvedValueOnce({ id: 't1' });
		const create = vi.fn().mockRejectedValue(new Error('unique constraint'));
		const pb = makePb({ getFirstListItem, create });
		await expect(addTrust(pb, 'a', 'b')).resolves.toBeUndefined();
		expect(create).toHaveBeenCalledTimes(1);
	});

	it('rethrows a genuine create error when no edge exists afterwards', async () => {
		const getFirstListItem = vi
			.fn()
			.mockRejectedValueOnce(new Error('none'))
			.mockRejectedValueOnce(new Error('still none'));
		const create = vi.fn().mockRejectedValue(new Error('boom'));
		const pb = makePb({ getFirstListItem, create });
		await expect(addTrust(pb, 'a', 'b')).rejects.toThrow('boom');
	});
});

describe('addTrustAndNotify', () => {
	beforeEach(() => vi.clearAllMocks());

	const truster = { id: 'a', username: 'Anna' };

	/** pb with a users_public target lookup plus trusts-collection mocks. */
	function makeTrustNotifyPb(
		target: { deleted?: boolean } | null,
		trusts: Record<string, ReturnType<typeof vi.fn>>
	): PocketBase {
		const usersPublic = {
			getOne:
				target === null
					? vi.fn().mockRejectedValue(new Error('not found'))
					: vi.fn().mockResolvedValue({ id: 'b', ...target }),
		};
		return {
			collection: vi.fn((name: string) =>
				name === 'trusts' ? trusts : name === 'users_public' ? usersPublic : {}
			),
			filter: vi.fn(mockFilter),
		} as unknown as PocketBase;
	}

	it('creates the edge and notifies the trustee (in-app + push)', async () => {
		const create = vi.fn().mockResolvedValue({ id: 't1' });
		const pb = makeTrustNotifyPb({}, {
			getFirstListItem: vi.fn().mockRejectedValue(new Error('none')),
			create,
		});

		const result = await addTrustAndNotify(pb, truster, 'b');

		expect(result).toEqual({ ok: true });
		expect(create).toHaveBeenCalledWith({ truster: 'a', trustee: 'b' });
		expect(createNotification).toHaveBeenCalledWith(
			pb,
			'b',
			'a',
			'trust_added',
			'a',
			expect.stringContaining('Anna')
		);
		expect(sendPushToUser).toHaveBeenCalledWith(
			pb,
			'b',
			texts.notifications.pushTitle,
			expect.stringContaining('Anna'),
			'/users/a'
		);
	});

	it('refuses a deleted (anonymized) target with a 400 and does not touch the edge', async () => {
		const create = vi.fn();
		const pb = makeTrustNotifyPb({ deleted: true }, { create });

		const result = await addTrustAndNotify(pb, truster, 'b');

		expect(result).toEqual({ ok: false, status: 400, message: texts.account.cannotTrustDeleted });
		expect(create).not.toHaveBeenCalled();
		expect(createNotification).not.toHaveBeenCalled();
	});

	it('returns a 404 when the target cannot be resolved', async () => {
		const pb = makeTrustNotifyPb(null, {});
		const result = await addTrustAndNotify(pb, truster, 'b');
		expect(result).toEqual({ ok: false, status: 404, message: texts.errors.somethingWentWrong });
	});

	it('surfaces an edge-creation failure as a 500 instead of pretending success (regression)', async () => {
		// Pre-check and post-failure re-check both say "no edge" → addTrust rethrows.
		const pb = makeTrustNotifyPb({}, {
			getFirstListItem: vi.fn().mockRejectedValue(new Error('none')),
			create: vi.fn().mockRejectedValue(new Error('boom')),
		});

		const result = await addTrustAndNotify(pb, truster, 'b');

		expect(result).toEqual({ ok: false, status: 500, message: texts.errors.somethingWentWrong });
		expect(createNotification).not.toHaveBeenCalled();
	});

	it('treats a notification failure as non-fatal — the edge exists, so the flow succeeded', async () => {
		vi.mocked(createNotification).mockRejectedValueOnce(new Error('push down'));
		const pb = makeTrustNotifyPb({}, {
			getFirstListItem: vi.fn().mockRejectedValue(new Error('none')),
			create: vi.fn().mockResolvedValue({ id: 't1' }),
		});

		const result = await addTrustAndNotify(pb, truster, 'b');

		expect(result).toEqual({ ok: true });
	});
});

describe('removeTrust', () => {
	it('deletes the matching edge', async () => {
		const del = vi.fn().mockResolvedValue(true);
		const pb = makePb({ getFirstListItem: vi.fn().mockResolvedValue({ id: 't1' }), delete: del });
		await removeTrust(pb, 'a', 'b');
		expect(del).toHaveBeenCalledWith('t1');
	});

	it('is a no-op when there is no edge', async () => {
		const del = vi.fn();
		const pb = makePb({ getFirstListItem: vi.fn().mockRejectedValue(new Error('none')), delete: del });
		await removeTrust(pb, 'a', 'b');
		expect(del).not.toHaveBeenCalled();
	});
});

describe('getTrustees / getTrusters', () => {
	it('getTrustees filters by truster and expands the trustee', async () => {
		const getFullList = vi.fn().mockResolvedValue([{ id: 't1', truster: 'a', trustee: 'b' }]);
		const pb = makePb({ getFullList });
		await getTrustees(pb, 'a');
		expect(getFullList).toHaveBeenCalledWith({
			filter: "truster = 'a'",
			expand: 'trustee',
			requestKey: 'trust-trustees',
		});
	});

	it('getTrusters filters by trustee and expands the truster', async () => {
		const getFullList = vi.fn().mockResolvedValue([{ id: 't2', truster: 'c', trustee: 'a' }]);
		const pb = makePb({ getFullList });
		await getTrusters(pb, 'a');
		expect(getFullList).toHaveBeenCalledWith({
			filter: "trustee = 'a'",
			expand: 'truster',
			requestKey: 'trust-trusters',
		});
	});

	it('getTrustees and getTrusters use distinct requestKeys (avoid auto-cancellation collision)', async () => {
		const trusteesFn = vi.fn().mockResolvedValue([]);
		const trustersFn = vi.fn().mockResolvedValue([]);
		await getTrustees(makePb({ getFullList: trusteesFn }), 'a');
		await getTrusters(makePb({ getFullList: trustersFn }), 'a');
		const k1 = trusteesFn.mock.calls[0][0].requestKey;
		const k2 = trustersFn.mock.calls[0][0].requestKey;
		expect(k1).toBeTruthy();
		expect(k2).toBeTruthy();
		expect(k1).not.toBe(k2);
	});
});

describe('getTrustDirections', () => {
	it('resolves both true when both edges exist', async () => {
		const getList = vi.fn().mockResolvedValue({
			items: [
				{ truster: 'a', trustee: 'b' },
				{ truster: 'b', trustee: 'a' },
			],
		});
		const pb = makePb({ getList });
		expect(await getTrustDirections(pb, 'a', 'b')).toEqual({ aTrustsB: true, bTrustsA: true });
	});

	it('resolves only aTrustsB when just the a→b edge exists', async () => {
		const getList = vi.fn().mockResolvedValue({ items: [{ truster: 'a', trustee: 'b' }] });
		const pb = makePb({ getList });
		expect(await getTrustDirections(pb, 'a', 'b')).toEqual({ aTrustsB: true, bTrustsA: false });
	});

	it('resolves only bTrustsA when just the b→a edge exists', async () => {
		const getList = vi.fn().mockResolvedValue({ items: [{ truster: 'b', trustee: 'a' }] });
		const pb = makePb({ getList });
		expect(await getTrustDirections(pb, 'a', 'b')).toEqual({ aTrustsB: false, bTrustsA: true });
	});

	it('resolves both false when neither edge exists', async () => {
		const getList = vi.fn().mockResolvedValue({ items: [] });
		const pb = makePb({ getList });
		expect(await getTrustDirections(pb, 'a', 'b')).toEqual({ aTrustsB: false, bTrustsA: false });
	});

	it('fails closed to both false when the query rejects', async () => {
		const getList = vi.fn().mockRejectedValue(new Error('network error'));
		const pb = makePb({ getList });
		expect(await getTrustDirections(pb, 'a', 'b')).toEqual({ aTrustsB: false, bTrustsA: false });
	});

	it('issues exactly one request, built via pb.filter covering both directions, with a stable requestKey', async () => {
		const getList = vi.fn().mockResolvedValue({ items: [] });
		const pb = makePb({ getList });
		await getTrustDirections(pb, 'a', 'b');

		expect(getList).toHaveBeenCalledTimes(1);
		expect(pb.filter).toHaveBeenCalledWith(
			'(truster={:a} && trustee={:b}) || (truster={:b} && trustee={:a})',
			{ a: 'a', b: 'b' }
		);
		const callArgs = getList.mock.calls[0];
		expect(callArgs[0]).toBe(1);
		expect(callArgs[1]).toBe(2);
		expect(callArgs[2]).toMatchObject({
			filter: "(truster='a' && trustee='b') || (truster='b' && trustee='a')",
			fields: 'truster,trustee',
			requestKey: 'trust-directions',
		});
	});
});
