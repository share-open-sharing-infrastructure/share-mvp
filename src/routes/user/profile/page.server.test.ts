import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the server helpers saveProfile delegates to, so the test exercises the
// action's own logic (validation, field parsing, the folded-in requirement save).
vi.mock('$lib/server/contacts', () => ({
	upsertOwnContact: vi.fn(() => Promise.resolve()),
	getOwnContact: vi.fn(() => Promise.resolve({})),
}));
vi.mock('$lib/server/geolocation', () => ({
	upsertUserGeolocation: vi.fn(() => Promise.resolve()),
}));
vi.mock('$lib/server/lendingRequirements', () => ({
	// Real field names so the action reads the right form fields.
	requirementFields: ['requireVerifiedEmail', 'requireAddress'],
	upsertOwnerRequirements: vi.fn(() => Promise.resolve()),
	getOwnerRequirements: vi.fn(() => Promise.resolve({})),
	getRequirementSettings: vi.fn(() => []),
}));

import { actions } from './+page.server';
import { upsertOwnContact } from '$lib/server/contacts';
import { upsertOwnerRequirements } from '$lib/server/lendingRequirements';

type SaveEvent = Parameters<typeof actions.saveProfile>[0];

function setup() {
	const update = vi.fn(() => Promise.resolve({}));
	const locals = {
		user: { id: 'u1' },
		pb: { collection: vi.fn(() => ({ update })) },
	};
	return { locals, update };
}

function callSave(locals: unknown, fields: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.set(k, v);
	return actions.saveProfile({
		locals,
		request: { formData: vi.fn().mockResolvedValue(fd) },
	} as unknown as SaveEvent);
}

describe('profile: saveProfile action', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects a username containing spaces without writing anything', async () => {
		const { locals, update } = setup();

		const result = await callSave(locals, { username: 'foo bar' });

		expect(result).toMatchObject({ error: true });
		expect(update).not.toHaveBeenCalled();
		expect(upsertOwnContact).not.toHaveBeenCalled();
		expect(upsertOwnerRequirements).not.toHaveBeenCalled();
	});

	it('rejects an invalid Telegram handle', async () => {
		const { locals, update } = setup();

		const result = await callSave(locals, {
			username: 'validname',
			telegramUsername: 'ab', // too short for the 5-32 rule
		});

		expect(result).toMatchObject({ error: true });
		expect(update).not.toHaveBeenCalled();
	});

	it('saves profile fields and folds in the lending-requirement toggles', async () => {
		const { locals, update } = setup();

		const result = await callSave(locals, {
			username: 'validname',
			bio: 'hello',
			requireAddress: 'on',
		});

		expect(result).toMatchObject({ success: true });
		// Primary user fields written.
		expect(update).toHaveBeenCalledTimes(1);
		// Contact + requirements always persisted by the single save bar.
		expect(upsertOwnContact).toHaveBeenCalledTimes(1);
		expect(upsertOwnerRequirements).toHaveBeenCalledWith(locals.pb, 'u1', {
			requireVerifiedEmail: false,
			requireAddress: true,
		});
	});

	it('still succeeds (and persists requirements) when only a requirement toggle changed', async () => {
		const { locals, update } = setup();

		const result = await callSave(locals, { requireVerifiedEmail: 'on' });

		expect(result).toMatchObject({ success: true });
		// No user-collection fields changed → no users.update call …
		expect(update).not.toHaveBeenCalled();
		// … but contact + requirements are still written (no spurious "nothing to update").
		expect(upsertOwnContact).toHaveBeenCalledTimes(1);
		expect(upsertOwnerRequirements).toHaveBeenCalledWith(locals.pb, 'u1', {
			requireVerifiedEmail: true,
			requireAddress: false,
		});
	});

	it('clears the profile image when removeProfileImage is set (deferred delete)', async () => {
		const { locals, update } = setup();

		const result = await callSave(locals, { removeProfileImage: 'true' });

		expect(result).toMatchObject({ success: true });
		// Removal counts as a user update; the image field is cleared (empty string).
		expect(update).toHaveBeenCalledTimes(1);
		const submitted = (update.mock.calls[0] as unknown[])[1] as FormData;
		expect(submitted.get('profileImage')).toBe('');
	});
});
