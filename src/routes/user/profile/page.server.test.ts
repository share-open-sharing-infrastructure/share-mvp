import { describe, it, expect, vi, beforeEach } from 'vitest';
import { texts } from '$lib/texts';
import { USERNAME_MAX_LENGTH } from '$lib/utils/username';

// hooks.server.ts (reached via +page.server's import chain) reads these.
vi.mock('$env/static/public', () => ({
	PUBLIC_PB_URL: 'http://localhost/',
	PUBLIC_VAPID_PUBLIC_KEY: 'x',
}));
// Stub the server helpers saveProfile delegates to, so the tests exercise the
// action's own logic (validation, field parsing, folded-in requirement save).
vi.mock('$lib/inviteSlug', () => ({ generateInviteSlug: vi.fn() }));
vi.mock('$lib/server/geolocation', () => ({
	upsertUserGeolocation: vi.fn(() => Promise.resolve()),
}));
vi.mock('$lib/server/contacts', () => ({
	upsertOwnContact: vi.fn(() => Promise.resolve()),
	getOwnContact: vi.fn(() => Promise.resolve({})),
}));
vi.mock('$lib/server/lendingRequirements', () => ({
	// Real field names so the action reads the right form fields.
	requirementFields: ['requireVerifiedEmail', 'requireAddress'],
	upsertOwnerRequirements: vi.fn(() => Promise.resolve()),
	getOwnerRequirements: vi.fn(() => Promise.resolve({})),
	getRequirementSettings: vi.fn(() => []),
}));
vi.mock('$lib/server/userPreferences', () => ({
	upsertUserPreferences: vi.fn(() => Promise.resolve()),
	getUserPreferences: vi.fn(() => Promise.resolve(null)),
}));

import { actions } from './+page.server';
import { upsertOwnContact } from '$lib/server/contacts';
import { upsertOwnerRequirements } from '$lib/server/lendingRequirements';
import { upsertUserPreferences } from '$lib/server/userPreferences';

type SaveEvent = Parameters<typeof actions.saveProfile>[0];

const USER_ID = 'u1';

function callSave(fields: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.set(k, v);
	const update = vi.fn().mockResolvedValue({});
	const pb = { collection: vi.fn(() => ({ update })) };
	const result = actions.saveProfile({
		locals: { pb, user: { id: USER_ID } },
		request: { formData: vi.fn().mockResolvedValue(fd) },
	} as unknown as SaveEvent);
	return { result, update, pb };
}

describe('profile: saveProfile action', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects a username with invalid characters without writing anything', async () => {
		const { result, update } = callSave({ username: 'foo@bar' });

		expect(await result).toMatchObject({ error: true, message: texts.errors.usernameInvalidFormat });
		expect(update).not.toHaveBeenCalled();
		expect(upsertOwnContact).not.toHaveBeenCalled();
		expect(upsertOwnerRequirements).not.toHaveBeenCalled();
	});

	it('accepts an institution username with spaces and writes it normalized', async () => {
		const { result, update } = callSave({ username: 'Ratsbücherei  Lüneburg' });

		expect(await result).toMatchObject({ success: true });
		expect(update).toHaveBeenCalledTimes(1);
		const pbFormData = update.mock.calls[0][1] as FormData;
		expect(pbFormData.get('username')).toBe('Ratsbücherei Lüneburg');
	});

	it('rejects a too-short username without writing anything', async () => {
		const { result, update } = callSave({ username: 'ab' });

		expect(await result).toMatchObject({ error: true, message: texts.errors.usernameTooShort });
		expect(update).not.toHaveBeenCalled();
	});

	it('rejects a too-long username without writing anything', async () => {
		const { result, update } = callSave({ username: 'a'.repeat(USERNAME_MAX_LENGTH + 1) });

		expect(await result).toMatchObject({ error: true, message: texts.errors.usernameTooLong });
		expect(update).not.toHaveBeenCalled();
	});

	it('treats a whitespace-only username as "unchanged" — succeeds, writes no username', async () => {
		// The action always writes the (unconditional) contact fields, so `update` still
		// runs — but a whitespace-only username normalizes to '' and must NOT be included.
		const { result, update } = callSave({ username: '   ' });

		expect(await result).toMatchObject({ success: true });
		const pbFormData = update.mock.calls[0]?.[1] as FormData | undefined;
		expect(pbFormData?.get('username') ?? null).toBeNull();
	});

	it('rejects an invalid Telegram handle', async () => {
		const { result, update } = callSave({
			username: 'validname',
			telegramUsername: 'ab', // too short for the 5-32 rule
		});

		expect(await result).toMatchObject({ error: true });
		expect(update).not.toHaveBeenCalled();
	});

	it('saves profile fields and folds in the lending-requirement toggles', async () => {
		const { result, update, pb } = callSave({
			username: 'validname',
			bio: 'hello',
			requireAddress: 'on',
		});

		expect(await result).toMatchObject({ success: true });
		// Primary user fields written.
		expect(update).toHaveBeenCalledTimes(1);
		// Contact + requirements always persisted by the single save bar.
		expect(upsertOwnContact).toHaveBeenCalledTimes(1);
		expect(upsertOwnerRequirements).toHaveBeenCalledWith(pb, USER_ID, {
			requireVerifiedEmail: false,
			requireAddress: true,
		});
	});

	it('persists the requirement toggles on save', async () => {
		const { result, pb } = callSave({ requireVerifiedEmail: 'on' });

		expect(await result).toMatchObject({ success: true });
		// Contact + requirements are always written by the single save bar (no spurious
		// "nothing to update").
		expect(upsertOwnContact).toHaveBeenCalledTimes(1);
		expect(upsertOwnerRequirements).toHaveBeenCalledWith(pb, USER_ID, {
			requireVerifiedEmail: true,
			requireAddress: false,
		});
	});

	it('clears the profile image when removeProfileImage is set (deferred delete)', async () => {
		const { result, update } = callSave({ removeProfileImage: 'true' });

		expect(await result).toMatchObject({ success: true });
		// Removal counts as a user update; the image field is cleared (empty string).
		expect(update).toHaveBeenCalledTimes(1);
		const submitted = (update.mock.calls[0] as unknown[])[1] as FormData;
		expect(submitted.get('profileImage')).toBe('');
	});

	it('upserts a valid transport mode to user_preferences (not the users row) (#426)', async () => {
		const { result, pb } = callSave({ username: 'validname', preferredTransportMode: 'car' });

		expect(await result).toMatchObject({ success: true });
		expect(upsertUserPreferences).toHaveBeenCalledWith(pb, USER_ID, {
			preferredTransportMode: 'car',
		});
	});

	it('does not touch user_preferences when no valid transport mode is submitted (#426)', async () => {
		const { result } = callSave({ username: 'validname', preferredTransportMode: 'spaceship' });

		expect(await result).toMatchObject({ success: true });
		expect(upsertUserPreferences).not.toHaveBeenCalled();
	});
});

describe('profile saveProfile — off-platform-contact opt-in (#438)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('persists an email contact (method + address) on the users record', async () => {
		const { result, update } = callSave({
			contactMethod: 'email',
			contactEmail: 'verleih@asta-lueneburg.de',
			contactUrl: '',
			contactPublic: 'on',
		});

		expect(await result).toMatchObject({ success: true });
		expect(update).toHaveBeenCalledTimes(1);
		const sent = (update.mock.calls[0] as unknown[])[1] as FormData;
		expect(sent.get('contactMethod')).toBe('email');
		expect(sent.get('contactEmail')).toBe('verleih@asta-lueneburg.de');
		expect(sent.get('contactPublic')).toBe('true');
	});

	it('persists a link contact (method + url)', async () => {
		const { result, update } = callSave({
			contactMethod: 'link',
			contactUrl: 'https://verleih.example/form',
		});

		expect(await result).toMatchObject({ success: true });
		const sent = (update.mock.calls[0] as unknown[])[1] as FormData;
		expect(sent.get('contactMethod')).toBe('link');
		expect(sent.get('contactUrl')).toBe('https://verleih.example/form');
	});

	it('rejects the email method without an address', async () => {
		const { result, update } = callSave({
			contactMethod: 'email',
			contactEmail: '  ',
		});

		expect(await result).toMatchObject({
			error: true,
			message: texts.errors.contactEmailRequired,
		});
		expect(update).not.toHaveBeenCalled();
	});

	it('rejects the link method without a url', async () => {
		const { result, update } = callSave({
			contactMethod: 'link',
			contactUrl: '  ',
		});

		expect(await result).toMatchObject({
			error: true,
			message: texts.errors.contactUrlRequired,
		});
		expect(update).not.toHaveBeenCalled();
	});

	it('rejects a malformed contact email', async () => {
		const { result, update } = callSave({
			contactMethod: 'email',
			contactEmail: 'not-an-email',
		});

		expect(await result).toMatchObject({
			error: true,
			message: texts.errors.invalidContactEmail,
		});
		expect(update).not.toHaveBeenCalled();
	});

	it('rejects a non-https contact url', async () => {
		const { result, update } = callSave({
			contactMethod: 'link',
			contactUrl: 'http://insecure.example/form',
		});

		expect(await result).toMatchObject({
			error: true,
			message: texts.errors.invalidContactUrl,
		});
		expect(update).not.toHaveBeenCalled();
	});

	it('forces contactPublic off when the method is off', async () => {
		// contactPublic checkbox present but method off → public must be coerced to false.
		const { result, update } = callSave({ contactPublic: 'on' });

		expect(await result).toMatchObject({ success: true });
		const sent = (update.mock.calls[0] as unknown[])[1] as FormData;
		expect(sent.get('contactMethod')).toBe('');
		expect(sent.get('contactPublic')).toBe('false');
	});

	it('clears the contact fields when nothing is submitted', async () => {
		// No contact fields → method off, fields empty, public off (written
		// unconditionally), erasing any stored values.
		const { result, update } = callSave({});

		expect(await result).toMatchObject({ success: true });
		const sent = (update.mock.calls[0] as unknown[])[1] as FormData;
		expect(sent.get('contactMethod')).toBe('');
		expect(sent.get('contactEmail')).toBe('');
		expect(sent.get('contactUrl')).toBe('');
		expect(sent.get('contactPublic')).toBe('false');
	});
});
