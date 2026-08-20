import { describe, it, expect, vi, beforeEach } from 'vitest';

// The load returns PB_IMG_URL from $lib/publicEnv's pbUrl(). Mocked so the assertion below
// pins an exact value instead of depending on the runner's env (issue #627 removed the
// PUBLIC_PB_URL injection that vitest.yaml used to do for exactly this test).
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_PB_URL: 'http://localhost/' } }));

import { load } from './+page.server';
import { ME, params, makeLocals } from './groupTestHelpers';

beforeEach(() => vi.clearAllMocks());

const url = new URL('http://x/user/groups/g1');

describe('group overview — load', () => {
	const groupItems = [
		{ id: 'i1', name: 'Bohrmaschine', status: 'available', categories: ['Werkzeug'], userId: 'u2' },
		{ id: 'i2', name: 'Zelt', status: 'unavailable', categories: ['Camping'], userId: 'u3' },
	];

	function localsWith(ownerId: string, itemsStub: { getFullList: ReturnType<typeof vi.fn> }, roster?: unknown[]) {
		return makeLocals({
			groups: { getOne: vi.fn().mockResolvedValue({ id: 'g1', name: 'X', owner: ownerId, description: '', isPublic: false }) },
			group_members: {
				getFullList: vi.fn().mockResolvedValue(
					roster ?? [
						{ id: 'm0', user: ownerId, role: 'admin' },
						{ id: 'm2', user: ME, role: 'member' },
					]
				),
			},
			items_searchable: itemsStub,
		});
	}

	it('loads items shared with the group and exposes them (owner view)', async () => {
		const getFullList = vi.fn().mockResolvedValue(groupItems);
		const locals = localsWith(ME, { getFullList });
		const res = await load({ locals, params, url } as never);

		expect(res.items).toEqual(groupItems);
		expect(res.isOwner).toBe(true);
		expect(res.PB_IMG_URL).toBe('http://localhost/');
		// Filter is built with pb.filter (injection-safe), scoped to this group.
		expect(locals.pb.filter).toHaveBeenCalledWith('groups ~ {:gid}', { gid: 'g1' });
		// The query must not return the `groups` column (would leak an item's other groups).
		const opts = getFullList.mock.calls[0][0];
		expect(opts.filter).toBe('groups ~ {:gid}');
		expect(opts.fields).toContain('status');
		expect(opts.fields).toContain('profileImage');
		expect(opts.fields).not.toContain('groups');
	});

	it('loads items for a plain member too', async () => {
		const getFullList = vi.fn().mockResolvedValue(groupItems);
		const locals = localsWith('someone-else', { getFullList });
		const res = await load({ locals, params, url } as never);
		expect(res.isOwner).toBe(false);
		expect(res.items).toEqual(groupItems);
	});

	it('redirects a non-owner who is also not a member away from the page', async () => {
		const locals = localsWith('someone-else', { getFullList: vi.fn() }, [{ id: 'm9', user: 'other' }]);
		await expect(load({ locals, params, url } as never)).rejects.toMatchObject({
			status: 303,
			location: '/user/groups',
		});
	});

	it('defaults items to [] when the query fails (no 500)', async () => {
		const getFullList = vi.fn().mockRejectedValue(new Error('boom'));
		const locals = localsWith(ME, { getFullList });
		const res = await load({ locals, params, url } as never);
		expect(res.items).toEqual([]);
	});
});
