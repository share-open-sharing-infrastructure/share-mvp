import { describe, it, expect, vi, beforeEach } from 'vitest';

const { isAdmin } = vi.hoisted(() => ({ isAdmin: vi.fn() }));
vi.mock('$lib/server/metrics', () => ({ isAdmin }));

import { load } from './+layout.server';
import { NOTIFICATIONS_DEP } from '$lib/constants';

type LoadEvent = Parameters<typeof load>[0];

describe('Root layout load', () => {
	let getList: ReturnType<typeof vi.fn>;
	let prefsGetFirstListItem: ReturnType<typeof vi.fn>;
	let depends: ReturnType<typeof vi.fn>;
	let filter: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		getList = vi.fn().mockResolvedValue({ totalItems: 3 });
		prefsGetFirstListItem = vi.fn().mockResolvedValue({ hasOnboarded: true, preferredTransportMode: 'car' });
		depends = vi.fn();
		filter = vi.fn((raw: string) => raw);
		isAdmin.mockResolvedValue(false);
	});

	function buildEvent(user: { id: string } | null) {
		return {
			depends,
			locals: {
				user,
				pb: {
					// notifications → getList; user_preferences → getFirstListItem (issue #426).
					collection: vi.fn((name: string) =>
						name === 'user_preferences' ? { getFirstListItem: prefsGetFirstListItem } : { getList }
					),
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

	it('issues the three authenticated reads concurrently, not sequentially', async () => {
		// Hold the notifications read open. Promise.all invokes all three calls synchronously
		// before awaiting, so all three mocks are hit before this promise ever settles.
		// Under the old sequential `await`s, preferences and isAdmin were awaited *after* the
		// notifications read resolved, so neither would have been called at this point —
		// that's what makes this assertion a real guard against a regression to sequencing.
		let releaseNotifications!: (value: { totalItems: number }) => void;
		getList.mockReturnValueOnce(
			new Promise<{ totalItems: number }>((resolve) => {
				releaseNotifications = resolve;
			})
		);

		const pending = load(buildEvent({ id: 'user1' }));

		expect(prefsGetFirstListItem).toHaveBeenCalled();
		expect(isAdmin).toHaveBeenCalled();

		releaseNotifications({ totalItems: 7 });
		expect((await pending).unreadNotificationCount).toBe(7);
	});

	it('reads the unread count with a distinct requestKey so a concurrent read cannot auto-cancel it', async () => {
		await load(buildEvent({ id: 'user1' }));
		expect(getList).toHaveBeenCalledWith(
			1,
			1,
			expect.objectContaining({ requestKey: 'notifications-unread-layout' })
		);
	});

	it('keeps the preferences and admin reads when the notifications query fails', async () => {
		getList.mockRejectedValueOnce(new Error('collection missing'));
		isAdmin.mockResolvedValue(true);
		const result = await load(buildEvent({ id: 'user1' }));
		// Promise.all rejects as soon as any input rejects, so the per-promise catch on the
		// notifications read is what stops one missing collection from sinking the other two.
		expect(result.unreadNotificationCount).toBe(0);
		expect(result.currentUserPreferences).toEqual({ hasOnboarded: true, preferredTransportMode: 'car' });
		expect(result.isAdminUser).toBe(true);
	});

	it('surfaces the user preferences with a distinct requestKey (issue #426)', async () => {
		const result = await load(buildEvent({ id: 'user1' }));
		expect(result.currentUserPreferences).toEqual({ hasOnboarded: true, preferredTransportMode: 'car' });
		// Distinct requestKey so the concurrent item/profile fetch of the same collection
		// doesn't auto-cancel this one under PocketBase SSR.
		expect(prefsGetFirstListItem).toHaveBeenCalledTimes(1);
		expect(prefsGetFirstListItem).toHaveBeenCalledWith('user = {:userId}', {
			requestKey: 'user-preferences-layout',
		});
	});

	it('does not query preferences and returns null for a guest (issue #426)', async () => {
		const result = await load(buildEvent(null));
		expect(result.currentUserPreferences).toBeNull();
		expect(prefsGetFirstListItem).not.toHaveBeenCalled();
	});

	it('surfaces isAdminUser for an admin, for the nav link', async () => {
		isAdmin.mockResolvedValue(true);
		const result = await load(buildEvent({ id: 'user1' }));
		expect(result.isAdminUser).toBe(true);
		expect(isAdmin).toHaveBeenCalledWith('user1');
	});

	it('does not check isAdmin and defaults isAdminUser to false for a guest', async () => {
		const result = await load(buildEvent(null));
		expect(result.isAdminUser).toBe(false);
		expect(isAdmin).not.toHaveBeenCalled();
	});
});
