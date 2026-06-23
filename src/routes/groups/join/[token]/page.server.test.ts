import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load, actions } from './+page.server';
import { texts } from '$lib/texts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockLocals: any;
const params = { token: 'tok123' };

// Action results are a union (ActionFailure | …); read fail fields loosely.
const r = (x: unknown) => x as { status?: number; data?: Record<string, unknown> };

function loggedIn(userId: string | null) {
	return {
		user: userId ? { id: userId } : null,
		pb: { send: vi.fn() },
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

	it('reports already-member feedback when the user is already in the group', async () => {
		mockLocals.pb.send.mockResolvedValue({ joined: true, alreadyMember: true, group: { id: 'g1', name: 'X' } });
		const res = await actions.join({ locals: mockLocals, params } as never);
		expect(res).toMatchObject({ joined: true, alreadyMember: true, groupName: 'X' });
	});

	it('returns a fail (not a redirect) with the expired message on HTTP 410', async () => {
		mockLocals.pb.send.mockRejectedValue({ status: 410 });
		const res = await actions.join({ locals: mockLocals, params } as never);
		expect(r(res).status).toBe(410);
		expect(r(res).data).toMatchObject({ fail: true, message: texts.groups.expiredInvite });
	});

	it('returns the generic invalid message on other errors', async () => {
		mockLocals.pb.send.mockRejectedValue({ status: 500 });
		const res = await actions.join({ locals: mockLocals, params } as never);
		expect(r(res).data).toMatchObject({ message: texts.groups.invalidInvite });
	});
});
