import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load } from './+layout.server';
import { NOTIFICATIONS_DEP } from '$lib/constants';

type LoadEvent = Parameters<typeof load>[0];

describe('Root layout load', () => {
	let getList: ReturnType<typeof vi.fn>;
	let depends: ReturnType<typeof vi.fn>;
	let filter: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		getList = vi.fn().mockResolvedValue({ totalItems: 3 });
		depends = vi.fn();
		filter = vi.fn((raw: string) => raw);
	});

	function buildEvent(user: { id: string } | null) {
		return {
			depends,
			locals: {
				user,
				pb: {
					collection: vi.fn(() => ({ getList })),
					filter,
					authStore: { token: 'jwt-token' },
				},
			},
		} as unknown as LoadEvent;
	}

	it('registers the notifications dependency so the badge can be invalidated on navigation (issue #376)', async () => {
		await load(buildEvent({ id: 'user1' }));
		// Asserted against the shared constant the client invalidates with, so a rename
		// on one side that silently no-ops the fix breaks this test.
		expect(depends).toHaveBeenCalledWith(NOTIFICATIONS_DEP);
	});

	it('returns the unread notification count for an authenticated user', async () => {
		const result = await load(buildEvent({ id: 'user1' }));
		expect(result.unreadNotificationCount).toBe(3);
		expect(filter).toHaveBeenCalledWith('recipient={:userId} && read=false', { userId: 'user1' });
	});

	it('returns a zero count without querying when there is no user', async () => {
		const result = await load(buildEvent(null));
		expect(result.unreadNotificationCount).toBe(0);
		expect(getList).not.toHaveBeenCalled();
		// dependency is still registered so an invalidate() never silently no-ops
		expect(depends).toHaveBeenCalledWith(NOTIFICATIONS_DEP);
	});

	it('falls back to zero when the notifications query fails', async () => {
		getList.mockRejectedValueOnce(new Error('collection missing'));
		const result = await load(buildEvent({ id: 'user1' }));
		expect(result.unreadNotificationCount).toBe(0);
		// prove the zero came from the catch branch, not an untaken query path,
		// and that the dependency is still registered even when the query throws
		expect(getList).toHaveBeenCalled();
		expect(depends).toHaveBeenCalledWith(NOTIFICATIONS_DEP);
	});
});
