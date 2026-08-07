import { describe, it, expect, vi } from 'vitest';

// social/+page.server imports notifications.ts (web-push), which validates VAPID key
// shapes at import time — provide decodable dummies.
vi.mock('$env/static/private', () => ({
	VAPID_PRIVATE_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
	VAPID_SUBJECT: 'mailto:test@example.com',
}));
vi.mock('$env/static/public', () => ({
	PUBLIC_PB_URL: 'http://localhost:8090',
	PUBLIC_VAPID_PUBLIC_KEY:
		'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
}));

import { load } from './+page.server';

function mockFilter(raw: string, params?: Record<string, unknown>): string {
	if (!params) return raw;
	let result = raw;
	for (const [key, value] of Object.entries(params)) {
		const escaped = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : `${value}`;
		result = result.replaceAll(`{:${key}}`, escaped);
	}
	return result;
}

const ME = 'me1';

// getTrustees (truster = me) is invoked before getTrusters (trustee = me), both via the
// same `trusts` getFullList mock — so once-sequencing feeds each its result in order.
function makePb(trustees: unknown[], trusters: unknown[]) {
	const trustsGetFullList = vi
		.fn()
		.mockResolvedValueOnce(trustees)
		.mockResolvedValueOnce(trusters);
	return {
		collection: vi.fn((name: string) => {
			if (name === 'users') return { getFullList: vi.fn().mockResolvedValue([{ id: 'x', username: 'X' }]) };
			if (name === 'trusts') return { getFullList: trustsGetFullList };
			return {};
		}),
		filter: vi.fn(mockFilter),
	};
}

function callLoad(pb: unknown) {
	return load({
		locals: { pb, user: { id: ME, username: 'Me', inviteCode: 'abc' } },
		url: { origin: 'http://localhost' },
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any);
}

describe('social load — bidirectional trust network', () => {
	it('merges mutual + one-directional edges and excludes deleted counterparts', async () => {
		const trustees = [
			{ trustee: 'A', expand: { trustee: { id: 'A', username: 'Alice', deleted: false } } }, // mutual (below)
			{ trustee: 'B', expand: { trustee: { id: 'B', username: 'Bob' } } }, // I trust B only
			{ trustee: 'D', expand: { trustee: { id: 'D', username: 'deleted-D', deleted: true } } }, // deleted → skip
		];
		const trusters = [
			{ truster: 'A', expand: { truster: { id: 'A', username: 'Alice' } } }, // mutual
			{ truster: 'C', expand: { truster: { id: 'C', username: 'Carol' } } }, // C trusts me only
		];

		const data = await callLoad(makePb(trustees, trusters));
		const byId = Object.fromEntries(data.trustNetwork.map((n) => [n.id, n]));

		expect(byId['A']).toMatchObject({ username: 'Alice', iTrustThem: true, theyTrustMe: true });
		expect(byId['B']).toMatchObject({ iTrustThem: true, theyTrustMe: false });
		expect(byId['C']).toMatchObject({ iTrustThem: false, theyTrustMe: true });
		expect(byId['D']).toBeUndefined(); // anonymized counterpart must not surface
		expect(data.trustNetwork).toHaveLength(3);
	});

	it('returns an empty network when there are no edges', async () => {
		const data = await callLoad(makePb([], []));
		expect(data.trustNetwork).toEqual([]);
	});
});
