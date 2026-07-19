import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load, actions } from './+page.server';
import { texts } from '$lib/texts';
import { createNotification, sendPushToUser } from '$lib/server/notifications';

// The join action notifies the group owner on a genuine new join; mock the helpers
// so we can assert the exact type/recipient/relatedId/url without web-push.
vi.mock('$lib/server/notifications', () => ({
	createNotification: vi.fn(),
	sendPushToUser: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockLocals: any;
const params = { token: 'tok123' };

// Action results are a union (ActionFailure | …); read fail fields loosely.
const r = (x: unknown) => x as { status?: number; data?: Record<string, unknown> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loggedIn(userId: string | null, opts: { username?: string; getOne?: any } = {}) {
	return {
		user: userId ? { id: userId, username: opts.username } : null,
		pb: {
			send: vi.fn(),
			collection: vi.fn(() => ({
				getOne: opts.getOne ?? vi.fn().mockResolvedValue({ owner: 'owner1' }),
			})),
		},
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mockLocals = loggedIn('user1');
});

describe('join invite — load (preview)', () => {
	it('maps a resolvable invite to state "valid" with the group name', async () => {
		mockLocals.pb.send.mockResolvedValue({ valid: true, group: { id: 'g1', name: 'Nachbarschaft' } });
		const res = await load({ locals: mockLocals, params } as never);
		expect(res).toMatchObject({ state: 'valid', groupName: 'Nachbarschaft', token: 'tok123', loggedIn: true });
		expect(mockLocals.pb.send).toHaveBeenCalledWith('/api/group-invite/tok123', { method: 'GET' });
	});

	it('maps HTTP 410 to state "expired"', async () => {
		mockLocals.pb.send.mockRejectedValue({ status: 410 });
		const res = await load({ locals: mockLocals, params } as never);
		expect(res.state).toBe('expired');
	});

	it('maps any other error to state "invalid"', async () => {
		mockLocals.pb.send.mockRejectedValue({ status: 404 });
		const res = await load({ locals: mockLocals, params } as never);
		expect(res.state).toBe('invalid');
	});

	it('reports loggedIn=false for a guest (preview still works)', async () => {
		mockLocals = loggedIn(null);
		mockLocals.pb.send.mockResolvedValue({ valid: true, group: { id: 'g1', name: 'X' } });
		const res = await load({ locals: mockLocals, params } as never);
		expect(res.loggedIn).toBe(false);
		expect(res.state).toBe('valid');
	});
});

describe('join invite — join action', () => {
	it('redirects a guest to login with a redirectTo back to the invite', async () => {
		mockLocals = loggedIn(null);
		await expect(actions.join({ locals: mockLocals, params } as never)).rejects.toMatchObject({
			status: 303,
			location: `/auth/login?redirectTo=${encodeURIComponent('/groups/join/tok123')}`,
		});
		// must not even attempt the join for a guest
		expect(mockLocals.pb.send).not.toHaveBeenCalled();
	});

	it('joins an authenticated user and returns success feedback (no redirect)', async () => {
		mockLocals.pb.send.mockResolvedValue({ joined: true, alreadyMember: false, group: { id: 'g1', name: 'X' } });
		const res = await actions.join({ locals: mockLocals, params } as never);
		expect(res).toMatchObject({ joined: true, alreadyMember: false, groupName: 'X' });
		expect(mockLocals.pb.send).toHaveBeenCalledWith('/api/group-invite/tok123/join', { method: 'POST' });
	});

	it('notifies the group owner (in-app + push) on a genuine new join', async () => {
		const getOne = vi.fn().mockResolvedValue({ owner: 'owner1' });
		mockLocals = loggedIn('user1', { username: 'Alice', getOne });
		mockLocals.pb.send.mockResolvedValue({ joined: true, alreadyMember: false, group: { id: 'g1', name: 'X' } });

		const res = await actions.join({ locals: mockLocals, params } as never);
		expect(res).toMatchObject({ joined: true, alreadyMember: false, groupName: 'X' });
		// Owner id is fetched from the groups record (the join response omits it).
		expect(mockLocals.pb.collection).toHaveBeenCalledWith('groups');
		expect(getOne).toHaveBeenCalledWith('g1', { fields: 'owner' });

		const body = texts.notifications.groupMemberJoined('Alice', 'X');
		expect(createNotification).toHaveBeenCalledWith(
			mockLocals.pb,
			'owner1',
			'user1',
			'group_member_joined',
			'g1',
			body
		);
		expect(sendPushToUser).toHaveBeenCalledWith(
			mockLocals.pb,
			'owner1',
			texts.notifications.pushTitle,
			body,
			'/user/groups/g1'
		);
	});

	it('reports already-member feedback when the user is already in the group, without notifying', async () => {
		mockLocals.pb.send.mockResolvedValue({ joined: true, alreadyMember: true, group: { id: 'g1', name: 'X' } });
		const res = await actions.join({ locals: mockLocals, params } as never);
		expect(res).toMatchObject({ joined: true, alreadyMember: true, groupName: 'X' });
		// Owner clicking their own link / re-join must not notify anyone.
		expect(createNotification).not.toHaveBeenCalled();
		expect(sendPushToUser).not.toHaveBeenCalled();
	});

	it('still reports a successful join when the owner lookup throws (error only logged)', async () => {
		const getOne = vi.fn().mockRejectedValue(new Error('owner fetch failed'));
		mockLocals = loggedIn('user1', { username: 'Alice', getOne });
		mockLocals.pb.send.mockResolvedValue({ joined: true, alreadyMember: false, group: { id: 'g1', name: 'X' } });
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const res = await actions.join({ locals: mockLocals, params } as never);
		// A notification failure must not turn the successful join into an error.
		expect(res).toMatchObject({ joined: true, alreadyMember: false, groupName: 'X' });
		expect(createNotification).not.toHaveBeenCalled();
		expect(sendPushToUser).not.toHaveBeenCalled();
		errSpy.mockRestore();
	});

	it('returns a fail (not a redirect) with the expired message on HTTP 410', async () => {
		mockLocals.pb.send.mockRejectedValue({ status: 410 });
		const res = await actions.join({ locals: mockLocals, params } as never);
		expect(r(res).status).toBe(410);
		expect(r(res).data).toMatchObject({ fail: true, message: texts.groups.expiredInvite });
		expect(createNotification).not.toHaveBeenCalled();
		expect(sendPushToUser).not.toHaveBeenCalled();
	});

	it('returns the generic invalid message on other errors', async () => {
		mockLocals.pb.send.mockRejectedValue({ status: 500 });
		const res = await actions.join({ locals: mockLocals, params } as never);
		expect(r(res).data).toMatchObject({ message: texts.groups.invalidInvite });
		expect(createNotification).not.toHaveBeenCalled();
		expect(sendPushToUser).not.toHaveBeenCalled();
	});
});
