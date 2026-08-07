import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMockPb } from '$lib/test-utils/pocketbase';

import { load } from './+page.server';

const ME = 'user1';

describe('notifications load()', () => {
	let getFullList: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		getFullList = vi.fn().mockResolvedValue([{ id: 'n1', body: 'hi', read: false }]);
	});

	function buildEvent(user: { id: string } | null) {
		const pb = makeMockPb({ notifications: { getFullList } });
		return { locals: { pb, user } } as unknown as Parameters<typeof load>[0];
	}

	it('lists the current user’s notifications, newest first, with the id as a bound param', async () => {
		const result = await load(buildEvent({ id: ME }));

		expect(result.notifications).toEqual([{ id: 'n1', body: 'hi', read: false }]);
		expect(getFullList).toHaveBeenCalledWith(
			expect.objectContaining({ filter: `recipient='${ME}'`, sort: '-created' })
		);
	});

	it('opts the list out of PocketBase auto-cancellation', async () => {
		await load(buildEvent({ id: ME }));
		// The root layout load queries this same collection for the unread badge on the very
		// same request; the SDK dedupes by method+path on the shared `locals.pb`, so without an
		// explicit key one of the two was cancelled at random — the symptom being a badge that
		// counted unread notifications above an empty list. See +layout.server.ts.
		expect(getFullList).toHaveBeenCalledWith(expect.objectContaining({ requestKey: null }));
	});

	it('renders an empty list instead of failing when the query errors', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		getFullList.mockRejectedValueOnce(new Error('boom'));

		const result = await load(buildEvent({ id: ME }));

		expect(result.notifications).toEqual([]);
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});

	it('redirects a guest to the login page', async () => {
		await expect(load(buildEvent(null))).rejects.toMatchObject({
			status: 303,
			location: '/auth/login',
		});
		expect(getFullList).not.toHaveBeenCalled();
	});
});
