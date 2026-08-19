import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load, actions } from './+page.server';
import { texts } from '$lib/texts';
import { ME, params, r, req, makeLocals } from '../groupTestHelpers';

beforeEach(() => vi.clearAllMocks());

const url = new URL('http://x/user/groups/g1/settings');

describe('settings — load (owner only)', () => {
	it('returns the group, public url and current invite for the owner', async () => {
		const locals = makeLocals({
			groups: { getOne: vi.fn().mockResolvedValue({ id: 'g1', name: 'X', owner: ME, description: 'Hallo', isPublic: true }) },
			group_members: { getFullList: vi.fn().mockResolvedValue([{ id: 'm0', user: ME, role: 'admin' }]) },
			group_invites: {
				getFirstListItem: vi.fn().mockResolvedValue({ id: 'inv1', token: 'tok', uses: 2, maxUses: 5, expiresAt: '' }),
			},
		});
		const res = await load({ locals, params, url } as never);
		expect(res.group).toMatchObject({ id: 'g1', name: 'X', description: 'Hallo', isPublic: true });
		expect(res.publicUrl).toBe('http://x/groups/g1');
		expect(res.invite).toMatchObject({ id: 'inv1', url: 'http://x/groups/join/tok', uses: 2, maxUses: 5 });
	});

	it('returns invite null when there is none', async () => {
		const locals = makeLocals({
			groups: { getOne: vi.fn().mockResolvedValue({ id: 'g1', name: 'X', owner: ME }) },
			group_members: { getFullList: vi.fn().mockResolvedValue([{ id: 'm0', user: ME, role: 'admin' }]) },
			group_invites: { getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }) },
		});
		const res = await load({ locals, params, url } as never);
		expect(res.invite).toBeNull();
	});

	it('redirects a member (non-owner) back to the group overview', async () => {
		const locals = makeLocals({
			groups: { getOne: vi.fn().mockResolvedValue({ id: 'g1', name: 'X', owner: 'someone-else' }) },
			group_members: {
				getFullList: vi.fn().mockResolvedValue([
					{ id: 'm0', user: 'someone-else', role: 'admin' },
					{ id: 'm2', user: ME, role: 'member' },
				]),
			},
		});
		await expect(load({ locals, params, url } as never)).rejects.toMatchObject({
			status: 303,
			location: '/user/groups/g1',
		});
	});
});

describe('settings — updateGroup', () => {
	it('fails when the name is empty', async () => {
		const update = vi.fn();
		const locals = makeLocals({ groups: { update } });
		const res = await actions.updateGroup({ locals, params, request: req({ name: '  ' }) } as never);
		expect(r(res).status).toBe(400);
		expect(r(res).data).toMatchObject({ message: texts.groups.nameRequired });
		expect(update).not.toHaveBeenCalled();
	});

	it('updates name, description and isPublic', async () => {
		const update = vi.fn().mockResolvedValue({ id: 'g1' });
		const locals = makeLocals({ groups: { update } });
		const res = await actions.updateGroup({
			locals,
			params,
			request: req({ name: 'Neu', description: 'Text', isPublic: 'on' }),
		} as never);
		expect(res).toMatchObject({ success: true });
		expect(update).toHaveBeenCalledWith('g1', { name: 'Neu', description: 'Text', isPublic: true });
	});

	it('surfaces a failure when the update rejects', async () => {
		const locals = makeLocals({ groups: { update: vi.fn().mockRejectedValue({ status: 500 }) } });
		const res = await actions.updateGroup({ locals, params, request: req({ name: 'Neu' }) } as never);
		expect(r(res).data).toMatchObject({ message: texts.errors.somethingWentWrong });
	});

	// Pre-existing, intentional server semantics, pinned here so nobody "fixes" them later:
	// `description` uses a `?? ''` fallback, so an absent field clears the stored description
	// just like an explicitly emptied one (unlike profile's `bio`, which is left untouched when
	// absent). The server therefore cannot tell a deliberate clear from a field that hydration
	// blanked before the user typed — which is precisely why #613's fix has to live client-side
	// (seed-once $state + bind:value in +page.svelte). Its regression coverage is the Playwright
	// spec, not this file.
	it.each([
		['submitted empty', { name: 'Neu', description: '' }],
		['absent entirely', { name: 'Neu' }],
	])('clears the stored description when the field is %s', async (_case, body) => {
		const update = vi.fn().mockResolvedValue({ id: 'g1' });
		const locals = makeLocals({ groups: { update } });

		const res = await actions.updateGroup({ locals, params, request: req(body) } as never);

		expect(res).toMatchObject({ success: true });
		expect(update).toHaveBeenCalledWith('g1', { name: 'Neu', description: '', isPublic: false });
	});
});

describe('settings — createInvite', () => {
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
		// The clear-existing lookup must go through pb.filter (parametrized — injection guardrail).
		expect(locals.pb.filter).toHaveBeenCalledWith('group = {:gid}', { gid: 'g1' });
	});
});

describe('settings — revokeInvite', () => {
	it('deletes the invite by id', async () => {
		const del = vi.fn().mockResolvedValue(true);
		const locals = makeLocals({ group_invites: { delete: del } });
		const res = await actions.revokeInvite({ locals, params, request: req({ inviteId: 'inv1' }) } as never);
		expect(res).toMatchObject({ success: true });
		expect(del).toHaveBeenCalledWith('inv1');
	});

	it('rejects a missing inviteId', async () => {
		const del = vi.fn();
		const locals = makeLocals({ group_invites: { delete: del } });
		const res = await actions.revokeInvite({ locals, params, request: req({}) } as never);
		expect(r(res).status).toBe(400);
		expect(r(res).data).toMatchObject({ message: texts.errors.missingId });
		expect(del).not.toHaveBeenCalled();
	});
});

describe('settings — deleteGroup', () => {
	it('deletes the group and redirects to the overview', async () => {
		const del = vi.fn().mockResolvedValue(true);
		const locals = makeLocals({ groups: { delete: del } });
		await expect(actions.deleteGroup({ locals, params } as never)).rejects.toMatchObject({
			status: 303,
			location: '/user/groups',
		});
		expect(del).toHaveBeenCalledWith('g1');
	});

	it('rejects a non-owner with 403 without deleting', async () => {
		const del = vi.fn();
		const locals = makeLocals({
			groups: { getOne: vi.fn().mockResolvedValue({ id: 'g1', owner: 'someone-else' }), delete: del },
		});
		const res = await actions.deleteGroup({ locals, params } as never);
		expect(r(res).status).toBe(403);
		expect(r(res).data).toMatchObject({ message: texts.errors.noPermission });
		expect(del).not.toHaveBeenCalled();
	});

	it('returns a fail (NOT a redirect) when the delete rejects', async () => {
		const locals = makeLocals({ groups: { delete: vi.fn().mockRejectedValue({ status: 500 }) } });
		// On failure it must return a fail() rather than throwing the success redirect,
		// so the owner is not misled into thinking the group was deleted.
		const res = await actions.deleteGroup({ locals, params } as never);
		expect(r(res).data).toMatchObject({ message: texts.errors.somethingWentWrong });
	});
});
