import { describe, it, expect, vi } from 'vitest';
import type PocketBase from 'pocketbase';
import { getUserPreferences, upsertUserPreferences } from './userPreferences';

function mockFilter(raw: string, params?: Record<string, unknown>): string {
	if (!params) return raw;
	let result = raw;
	for (const [key, value] of Object.entries(params)) {
		const escaped = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : `${value}`;
		result = result.replaceAll(`{:${key}}`, escaped);
	}
	return result;
}

/** Build a pb whose `user_preferences` collection uses the provided method mocks. */
function makePb(prefs: Record<string, ReturnType<typeof vi.fn>>): PocketBase {
	return {
		collection: vi.fn((name: string) => (name === 'user_preferences' ? prefs : {})),
		filter: vi.fn(mockFilter),
	} as unknown as PocketBase;
}

describe('getUserPreferences', () => {
	it('returns the row when one exists', async () => {
		const getFirstListItem = vi.fn().mockResolvedValue({ id: 'p1', user: 'u1', hasOnboarded: true });
		const pb = makePb({ getFirstListItem });
		expect(await getUserPreferences(pb, 'u1')).toEqual({ id: 'p1', user: 'u1', hasOnboarded: true });
		expect(getFirstListItem).toHaveBeenCalledWith("user = 'u1'", { requestKey: 'user-preferences' });
	});

	it('returns null when no row exists (404)', async () => {
		const pb = makePb({ getFirstListItem: vi.fn().mockRejectedValue(new Error('404')) });
		expect(await getUserPreferences(pb, 'u1')).toBeNull();
	});

	it('forwards a caller-supplied requestKey (avoids SSR auto-cancellation collisions)', async () => {
		const getFirstListItem = vi.fn().mockResolvedValue({ id: 'p1' });
		const pb = makePb({ getFirstListItem });
		await getUserPreferences(pb, 'u1', 'user-preferences-item');
		expect(getFirstListItem).toHaveBeenCalledWith("user = 'u1'", { requestKey: 'user-preferences-item' });
	});
});

describe('upsertUserPreferences', () => {
	it('updates the existing row, patching only the given fields', async () => {
		const update = vi.fn().mockResolvedValue({ id: 'p1' });
		const create = vi.fn();
		const pb = makePb({
			getFirstListItem: vi.fn().mockResolvedValue({ id: 'p1', user: 'u1' }),
			update,
			create,
		});
		await upsertUserPreferences(pb, 'u1', { preferredTransportMode: 'car' });
		expect(update).toHaveBeenCalledWith('p1', { preferredTransportMode: 'car' });
		expect(create).not.toHaveBeenCalled();
	});

	it('creates a row when none exists, hardening emailNotifications/digestEmails to true (#607 B2 regression)', async () => {
		// PocketBase `bool` columns have no NULL state: a row created WITHOUT these two
		// fields would read back as `false` for both — the opposite of the documented
		// "missing row = opted in" default. This is exactly the trap the onboarding call
		// site (`upsertUserPreferences(pb, uid, { hasOnboarded: true })`, reproduced here)
		// used to fall into, silently opting every onboarded user out of ALL notification
		// mail. createData must explicitly default both to true, with the caller's patch
		// spread on top so an explicit patch value still wins.
		const create = vi.fn().mockResolvedValue({ id: 'p2' });
		const pb = makePb({
			getFirstListItem: vi.fn().mockRejectedValue(new Error('404')),
			create,
			update: vi.fn(),
		});
		await upsertUserPreferences(pb, 'u1', { hasOnboarded: true });
		expect(create).toHaveBeenCalledWith({
			user: 'u1',
			emailNotifications: true,
			digestEmails: true,
			hasOnboarded: true,
		});
	});

	it('lets an explicit patch value override the emailNotifications/digestEmails hardening on create', async () => {
		const create = vi.fn().mockResolvedValue({ id: 'p2' });
		const pb = makePb({
			getFirstListItem: vi.fn().mockRejectedValue(new Error('404')),
			create,
			update: vi.fn(),
		});
		await upsertUserPreferences(pb, 'u1', { emailNotifications: false, digestEmails: false });
		expect(create).toHaveBeenCalledWith({
			user: 'u1',
			emailNotifications: false,
			digestEmails: false,
		});
	});

	it('tolerates a create race: create rejects but a row now exists → update instead', async () => {
		// First getFirstListItem (pre-check) → 404, then post-failure re-check → the row.
		const getFirstListItem = vi
			.fn()
			.mockRejectedValueOnce(new Error('404'))
			.mockResolvedValueOnce({ id: 'p3', user: 'u1' });
		const create = vi.fn().mockRejectedValue(new Error('unique constraint'));
		const update = vi.fn().mockResolvedValue({ id: 'p3' });
		const pb = makePb({ getFirstListItem, create, update });
		await expect(upsertUserPreferences(pb, 'u1', { hasOnboarded: true })).resolves.toBeUndefined();
		expect(update).toHaveBeenCalledWith('p3', { hasOnboarded: true });
	});

	it('rethrows a genuine create error when still no row exists afterwards', async () => {
		const getFirstListItem = vi
			.fn()
			.mockRejectedValueOnce(new Error('404'))
			.mockRejectedValueOnce(new Error('still 404'));
		const create = vi.fn().mockRejectedValue(new Error('boom'));
		const pb = makePb({ getFirstListItem, create, update: vi.fn() });
		await expect(upsertUserPreferences(pb, 'u1', { hasOnboarded: true })).rejects.toThrow('boom');
	});
});
