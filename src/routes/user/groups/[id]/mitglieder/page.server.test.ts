import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load, actions } from './+page.server';
import { texts } from '$lib/texts';
import { ME, params, r, req, makeLocals } from '../groupTestHelpers';

beforeEach(() => vi.clearAllMocks());

const url = new URL('http://x/user/groups/g1/mitglieder');

describe('members — addMember', () => {
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
		expect(create).toHaveBeenCalledWith({ group: 'g1', user: 'u2', role: 'member' });
		// Username lookup must go through pb.filter (parametrized — injection guardrail).
		expect(locals.pb.filter).toHaveBeenCalledWith('username = {:u}', { u: 'bob' });
	});

	it('rejects a non-owner with 403 before touching membership', async () => {
		const create = vi.fn();
		const locals = makeLocals({
			groups: { getOne: vi.fn().mockResolvedValue({ id: 'g1', owner: 'someone-else' }) },
			group_members: { create },
		});
		const res = await actions.addMember({ locals, params, request: req({ userId: 'u2' }) } as never);
		expect(r(res).status).toBe(403);
		expect(r(res).data).toMatchObject({ message: texts.errors.noPermission });
		expect(create).not.toHaveBeenCalled();
	});

	it('rejects an empty submission (neither userId nor username)', async () => {
		const create = vi.fn();
		const locals = makeLocals({ group_members: { create } });
		const res = await actions.addMember({ locals, params, request: req({}) } as never);
		expect(r(res).status).toBe(400);
		expect(r(res).data).toMatchObject({ message: texts.groups.usernameRequired });
		expect(create).not.toHaveBeenCalled();
	});

	it('adds by a resolved userId (from the search dropdown) without a username lookup', async () => {
		const create = vi.fn().mockResolvedValue({ id: 'm1' });
		const getOne = vi.fn().mockResolvedValue({ id: 'u2' });
		const getFirstListItem = vi.fn();
		const locals = makeLocals({
			users: { getOne, getFirstListItem },
			group_members: { create },
		});
		const res = await actions.addMember({ locals, params, request: req({ userId: 'u2' }) } as never);
		expect(res).toMatchObject({ success: true });
		expect(getOne).toHaveBeenCalledWith('u2', { fields: 'id' });
		expect(getFirstListItem).not.toHaveBeenCalled();
		expect(create).toHaveBeenCalledWith({ group: 'g1', user: 'u2', role: 'member' });
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

describe('members — removeMember', () => {
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

	it('refuses to remove an admin membership (the owner must delete the group)', async () => {
		const del = vi.fn();
		const locals = makeLocals({
			group_members: {
				getOne: vi.fn().mockResolvedValue({ id: 'm1', group: 'g1', role: 'admin' }),
				delete: del,
			},
		});
		const res = await actions.removeMember({ locals, params, request: req({ membershipId: 'm1' }) } as never);
		expect(r(res).status).toBe(400);
		expect(r(res).data).toMatchObject({ message: texts.groups.cannotRemoveAdmin });
		expect(del).not.toHaveBeenCalled();
	});

	it('rejects a missing membershipId', async () => {
		const del = vi.fn();
		const locals = makeLocals({ group_members: { delete: del } });
		const res = await actions.removeMember({ locals, params, request: req({}) } as never);
		expect(r(res).status).toBe(400);
		expect(r(res).data).toMatchObject({ message: texts.errors.missingId });
		expect(del).not.toHaveBeenCalled();
	});

	it('surfaces a failure when the delete rejects', async () => {
		const locals = makeLocals({
			group_members: {
				getOne: vi.fn().mockResolvedValue({ id: 'm1', group: 'g1', role: 'member' }),
				delete: vi.fn().mockRejectedValue({ status: 500 }),
			},
		});
		const res = await actions.removeMember({ locals, params, request: req({ membershipId: 'm1' }) } as never);
		expect(r(res).data).toMatchObject({ message: texts.errors.somethingWentWrong });
	});
});

describe('members — load', () => {
	it('lets a member view the roster read-only (isOwner false, no candidates)', async () => {
		const locals = makeLocals({
			groups: { getOne: vi.fn().mockResolvedValue({ id: 'g1', name: 'X', owner: 'someone-else' }) },
			group_members: {
				getFullList: vi.fn().mockResolvedValue([
					{ id: 'm1', user: 'someone-else', role: 'admin', expand: { user: { id: 'someone-else', username: 'Chef' } } },
					{ id: 'm2', user: ME, role: 'member', expand: { user: { id: ME, username: 'Me' } } },
				]),
			},
		});
		const res = await load({ locals, params, url } as never);
		expect(res.isOwner).toBe(false);
		expect(res.candidateUsers).toEqual([]);
		expect(res.members).toHaveLength(2);
		expect(res.members.map((m) => m.userId).sort()).toEqual(['me', 'someone-else']);
		expect(res.members[0].role).toBe('admin'); // admins sort first
		expect(res.currentUserId).toBe(ME);
	});

	it('flags members who currently have an active lending of the owner items', async () => {
		const locals = makeLocals({
			groups: { getOne: vi.fn().mockResolvedValue({ id: 'g1', name: 'Nord', owner: ME }) },
			group_members: {
				getFullList: vi.fn().mockResolvedValue([
					{ id: 'm0', user: ME, role: 'admin', expand: { user: { id: ME, username: 'Me' } } },
					{ id: 'm1', user: 'u2', role: 'member', expand: { user: { id: 'u2', username: 'Bob' } } },
					{ id: 'm2', user: 'u3', role: 'member', expand: { user: { id: 'u3', username: 'Ann' } } },
				]),
			},
			conversations: {
				getFullList: vi.fn().mockResolvedValue([{ requester: 'u2', lendingStatus: 'active' }]),
			},
			users: { getFullList: vi.fn().mockResolvedValue([{ id: 'u4', username: 'New' }]) },
		});

		const res = await load({ locals, params, url } as never);
		const bob = res.members.find((m) => m.userId === 'u2');
		const ann = res.members.find((m) => m.userId === 'u3');
		expect(bob?.hasActiveLending).toBe(true);
		expect(ann?.hasActiveLending).toBe(false);
		expect(res.isOwner).toBe(true);
		expect(res.candidateUsers).toEqual([{ id: 'u4', username: 'New' }]);
	});

	it('masks a deleted member and drops deleted accounts from the add candidates', async () => {
		const locals = makeLocals({
			groups: { getOne: vi.fn().mockResolvedValue({ id: 'g1', name: 'X', owner: ME }) },
			group_members: {
				getFullList: vi.fn().mockResolvedValue([
					{ id: 'm0', user: ME, role: 'admin', expand: { user: { id: ME, username: 'Me' } } },
					{ id: 'm1', user: 'gone', role: 'member', expand: { user: { id: 'gone', username: 'deleted-gone', deleted: true } } },
				]),
			},
			conversations: { getFullList: vi.fn().mockResolvedValue([]) },
			users: {
				getFullList: vi.fn().mockResolvedValue([
					{ id: 'u4', username: 'New' },
					{ id: 'gone2', username: 'deleted-gone2', deleted: true },
				]),
			},
		});
		const res = await load({ locals, params, url } as never);
		const gone = res.members.find((m) => m.userId === 'gone');
		expect(gone?.username).toBe(texts.account.deletedAccountName);
		// A deleted account must not be offered as an add candidate.
		expect(res.candidateUsers).toEqual([{ id: 'u4', username: 'New' }]);
	});
});
