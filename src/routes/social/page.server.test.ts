import { describe, it, expect, vi } from 'vitest';

// No env mock needed since #627: social/+page.server still imports notifications.ts, but
// web-push is configured lazily inside sendPushToUser, so the import validates nothing.

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
			{ trustee: 'A', expand: { trustee: { id: 'A', username: 'Alice', deleted: false, profileImage: 'alice.png' } } }, // mutual (below)
			{ trustee: 'B', expand: { trustee: { id: 'B', username: 'Bob' } } }, // I trust B only, no profileImage
			{ trustee: 'D', expand: { trustee: { id: 'D', username: 'deleted-D', deleted: true } } }, // deleted → skip
		];
		const trusters = [
			{ truster: 'A', expand: { truster: { id: 'A', username: 'Alice' } } }, // mutual
			{ truster: 'C', expand: { truster: { id: 'C', username: 'Carol' } } }, // C trusts me only
		];

		const data = await callLoad(makePb(trustees, trusters));
		const byId = Object.fromEntries(data.trustNetwork.map((n) => [n.id, n]));

		expect(byId['A']).toMatchObject({
			username: 'Alice',
			profileImage: 'alice.png',
			iTrustThem: true,
			theyTrustMe: true,
		});
		expect(byId['B']).toMatchObject({ iTrustThem: true, theyTrustMe: false, profileImage: null });
		expect(byId['C']).toMatchObject({ iTrustThem: false, theyTrustMe: true, profileImage: null });
		expect(byId['D']).toBeUndefined(); // anonymized counterpart must not surface
		expect(data.trustNetwork).toHaveLength(3);
	});

	it('passes profileImage through as the raw filename and adds no derived avatar field', async () => {
		const trustees = [
			{ trustee: 'A', expand: { trustee: { id: 'A', username: 'Alice', profileImage: 'alice.png' } } },
		];
		const data = await callLoad(makePb(trustees, []));

		expect(data.trustNetwork).toHaveLength(1);
		// The avatar URL is built in the component (TrustNetworkTable.svelte) from pbUrl();
		// the loader must ship the bare filename, and no leftover third-party avatar field.
		expect(data.trustNetwork[0].profileImage).toBe('alice.png');
		expect(data.trustNetwork[0]).not.toHaveProperty('profilePic');
	});

	it('returns an empty network when there are no edges', async () => {
		const data = await callLoad(makePb([], []));
		expect(data.trustNetwork).toEqual([]);
	});
});
