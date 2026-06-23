import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load, actions } from './+page.server';
import { texts } from '$lib/texts';

const ME = 'me';
const params = { id: 'g1' };

// Action results are a union (ActionFailure | …); read fail fields loosely.
const r = (x: unknown) => x as { status?: number; data?: Record<string, unknown> };

// Build a request whose formData() resolves to the given key/value pairs.
function req(fields: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.append(k, v);
	return { formData: () => Promise.resolve(fd) };
}

// locals with a pb whose collection(name) returns the per-test stub object.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeLocals(collections: Record<string, any>) {
	return {
		user: { id: ME },
		pb: {
			filter: (raw: string) => raw,
			collection: vi.fn((name: string) => collections[name] ?? {}),
		},
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

beforeEach(() => vi.clearAllMocks());

describe('manage group — addMember', () => {
	it('rejects adding yourself (you already own/manage the group)', async () => {
		const create = vi.fn();
		const locals = makeLocals({
			users: { getFirstListItem: vi.fn().mockResolvedValue({ id: ME }) },
			group_members: { create },
		});
		const res = await actions.addMember({ locals, params, request: req({ username: 'me' }) } as never);
		expect(r(res).status).toBe(400);
		expect(r(res).data).toMatchObject({ message: texts.groups.cannotAddSelf });
		expect(create).not.toHaveBeenCalled();
	});

	it('returns userNotFound when the username does not resolve', async () => {
		const locals = makeLocals({
			users: { getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }) },
		});
		const res = await actions.addMember({ locals, params, request: req({ username: 'ghost' }) } as never);
		expect(r(res).status).toBe(404);
		expect(r(res).data).toMatchObject({ message: texts.errors.userNotFound });
	});

	it('creates the membership for a valid different user', async () => {
		const create = vi.fn().mockResolvedValue({ id: 'm1' });
		const locals = makeLocals({
			users: { getFirstListItem: vi.fn().mockResolvedValue({ id: 'u2' }) },
			group_members: { create },
		});
		const res = await actions.addMember({ locals, params, request: req({ username: 'bob' }) } as never);
		expect(res).toMatchObject({ success: true });
		expect(create).toHaveBeenCalledWith({ group: 'g1', user: 'u2' });
	});

	it('is idempotent: a duplicate (already-member) create still reports success', async () => {
		const locals = makeLocals({
			users: { getFirstListItem: vi.fn().mockResolvedValue({ id: 'u2' }) },
			group_members: {
				create: vi.fn().mockRejectedValue({ status: 400 }),
				getFirstListItem: vi.fn().mockResolvedValue({ id: 'existing' }), // membership exists
			},
		});
		const res = await actions.addMember({ locals, params, request: req({ username: 'bob' }) } as never);
		expect(res).toMatchObject({ success: true });
	});

	it('surfaces a real failure when create fails AND no membership exists', async () => {
		const locals = makeLocals({
			users: { getFirstListItem: vi.fn().mockResolvedValue({ id: 'u2' }) },
			group_members: {
				create: vi.fn().mockRejectedValue({ status: 400 }),
				getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }), // not a member
			},
		});
		const res = await actions.addMember({ locals, params, request: req({ username: 'bob' }) } as never);
		expect(r(res).data).toMatchObject({ message: texts.errors.somethingWentWrong });
	});
});

describe('manage group — removeMember', () => {
	it('refuses to delete a membership that belongs to a different group', async () => {
		const del = vi.fn();
		const locals = makeLocals({
			group_members: { getOne: vi.fn().mockResolvedValue({ id: 'm1', group: 'OTHER' }), delete: del },
		});
		const res = await actions.removeMember({ locals, params, request: req({ membershipId: 'm1' }) } as never);
		expect(r(res).status).toBe(403);
		expect(del).not.toHaveBeenCalled();
	});

	it('deletes a membership that belongs to this group', async () => {
		const del = vi.fn().mockResolvedValue(true);
		const locals = makeLocals({
			group_members: { getOne: vi.fn().mockResolvedValue({ id: 'm1', group: 'g1' }), delete: del },
		});
		const res = await actions.removeMember({ locals, params, request: req({ membershipId: 'm1' }) } as never);
		expect(res).toMatchObject({ success: true });
		expect(del).toHaveBeenCalledWith('m1');
	});
});

describe('manage group — createInvite', () => {
	it('stores a date-only expiry as inclusive end-of-day and parses maxUses', async () => {
		const create = vi.fn().mockResolvedValue({ id: 'inv1' });
		const locals = makeLocals({
			group_invites: { getFullList: vi.fn().mockResolvedValue([]), delete: vi.fn(), create },
		});
		await actions.createInvite({
			locals,
			params,
			request: req({ expiresAt: '2026-06-30', maxUses: '5' }),
		} as never);
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				group: 'g1',
				createdBy: ME,
				uses: 0,
				maxUses: 5,
				expiresAt: '2026-06-30 23:59:59.000Z',
			})
		);
	});

	it('omits expiresAt when none is given and defaults maxUses to 0', async () => {
		const create = vi.fn().mockResolvedValue({ id: 'inv1' });
		const locals = makeLocals({
			group_invites: { getFullList: vi.fn().mockResolvedValue([]), delete: vi.fn(), create },
		});
		await actions.createInvite({ locals, params, request: req({ maxUses: '' }) } as never);
		const arg = create.mock.calls[0][0];
		expect(arg.maxUses).toBe(0);
		expect('expiresAt' in arg).toBe(false);
	});

	it('revokes any existing invites before creating the new one (single active link)', async () => {
		const del = vi.fn().mockResolvedValue(true);
		const create = vi.fn().mockResolvedValue({ id: 'inv2' });
		const locals = makeLocals({
			group_invites: {
				getFullList: vi.fn().mockResolvedValue([{ id: 'old1' }, { id: 'old2' }]),
				delete: del,
				create,
			},
		});
		await actions.createInvite({ locals, params, request: req({ maxUses: '0' }) } as never);
		expect(del).toHaveBeenCalledWith('old1');
		expect(del).toHaveBeenCalledWith('old2');
		expect(create).toHaveBeenCalled();
	});
});

describe('manage group — deleteGroup', () => {
	it('deletes the group and redirects to the overview', async () => {
		const del = vi.fn().mockResolvedValue(true);
		const locals = makeLocals({ groups: { delete: del } });
		await expect(actions.deleteGroup({ locals, params } as never)).rejects.toMatchObject({
			status: 303,
			location: '/user/groups',
		});
		expect(del).toHaveBeenCalledWith('g1');
	});
});

describe('manage group — load', () => {
	it('redirects a non-owner away from the manage page', async () => {
		const locals = makeLocals({
			groups: { getOne: vi.fn().mockResolvedValue({ id: 'g1', name: 'X', owner: 'someone-else' }) },
		});
		await expect(load({ locals, params, url: new URL('http://x/user/groups/g1') } as never)).rejects.toMatchObject({
			status: 303,
			location: '/user/groups',
		});
	});

	it('flags members who currently have an active lending of the owner items', async () => {
		const locals = makeLocals({
			groups: { getOne: vi.fn().mockResolvedValue({ id: 'g1', name: 'Nord', owner: ME, description: '' }) },
			group_members: {
				getFullList: vi.fn().mockResolvedValue([
					{ id: 'm1', user: 'u2', expand: { user: { id: 'u2', username: 'Bob' } } },
					{ id: 'm2', user: 'u3', expand: { user: { id: 'u3', username: 'Ann' } } },
				]),
			},
			conversations: {
				getFullList: vi.fn().mockResolvedValue([{ requester: 'u2', lendingStatus: 'active' }]),
			},
			group_invites: { getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }) },
		});

		const res = await load({ locals, params, url: new URL('http://x/user/groups/g1') } as never);
		const bob = res.members.find((m) => m.userId === 'u2');
		const ann = res.members.find((m) => m.userId === 'u3');
		expect(bob?.hasActiveLending).toBe(true);
		expect(ann?.hasActiveLending).toBe(false);
		expect(res.invite).toBeNull();
	});
});
