import { describe, it, expect, vi } from 'vitest';
import type PocketBase from 'pocketbase';

// Hermetic env: registration.ts pulls in notifications.ts, whose import-time
// `setVapidDetails` call crashes when a checkout has no .env (e.g. CI). web-push
// validates key shapes, so the dummies must decode to 32 (private) / 65 (public) bytes.
vi.mock('$env/static/private', () => ({
	VAPID_PRIVATE_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
	VAPID_SUBJECT: 'mailto:test@example.com',
}));
vi.mock('$env/static/public', () => ({
	PUBLIC_PB_URL: 'http://localhost:8090',
	PUBLIC_VAPID_PUBLIC_KEY:
		'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
}));

import {
	validateRegistrationForm,
	resolveInviter,
	buildCreateUserPayload,
	createUserAndAuthenticate,
} from './registration';
import type { User } from '$lib/types/models';
import { texts } from '$lib/texts';
import { USERNAME_MAX_LENGTH } from '$lib/utils/username';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFilter(raw: string, params?: Record<string, unknown>): string {
	if (!params) return raw;
	let result = raw;
	for (const [key, value] of Object.entries(params)) {
		const escaped = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : `${value}`;
		result = result.replaceAll(`{:${key}}`, escaped);
	}
	return result;
}

function makeMockPb(
	collectionImpl: (name: string) => object,
	sendImpl?: (...args: unknown[]) => unknown
): PocketBase {
	return {
		collection: vi.fn((name: string) => collectionImpl(name)),
		filter: vi.fn(mockFilter),
		send: vi.fn(sendImpl)
	} as unknown as PocketBase;
}

function makeFormData(fields: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		fd.set(key, value);
	}
	return fd;
}

const validFormFields = {
	email: 'test@example.com',
	password: 'password123',
	username: 'testuser',
	userConsent: 'on',
};

const stubUser: User = { id: 'u1', username: 'inviter', email: '', created: '', updated: '', trusts: [] };

// ---------------------------------------------------------------------------
// validateRegistrationForm
// ---------------------------------------------------------------------------

describe('validateRegistrationForm', () => {
	it('returns ok with all fields for valid input', () => {
		const result = validateRegistrationForm(makeFormData(validFormFields));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.email).toBe('test@example.com');
		expect(result.password).toBe('password123');
		expect(result.username).toBe('testuser');
		expect(result.subscribeToNewsletter).toBe(false);
		expect(result.inviteCode).toBeNull();
	});

	it('parses subscribeToNewsletter and inviteCode', () => {
		const result = validateRegistrationForm(
			makeFormData({ ...validFormFields, subscribeToNewsletter: 'on', inviteCode: 'abc123' })
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.subscribeToNewsletter).toBe(true);
		expect(result.inviteCode).toBe('abc123');
	});

	it('trims whitespace from username', () => {
		const result = validateRegistrationForm(
			makeFormData({ ...validFormFields, username: '  alice  ' })
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.username).toBe('alice');
	});

	it('accepts usernames with unicode letters', () => {
		const result = validateRegistrationForm(
			makeFormData({ ...validFormFields, username: 'MüllerMax' })
		);
		expect(result.ok).toBe(true);
	});

	it('fails when email is missing', () => {
		const fd = makeFormData({ password: 'password123', username: 'user', userConsent: 'on' });
		const result = validateRegistrationForm(fd);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fields).toMatchObject({ emailRequired: true, passwordRequired: false });
	});

	it('fails when password is missing', () => {
		const fd = makeFormData({ email: 'a@b.com', username: 'user', userConsent: 'on' });
		const result = validateRegistrationForm(fd);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fields).toMatchObject({ passwordRequired: true });
	});

	it('fails when password is too short', () => {
		const result = validateRegistrationForm(
			makeFormData({ ...validFormFields, password: 'short' })
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fields).toMatchObject({ message: texts.errors.passwordTooShort });
	});

	it('fails when userConsent is not checked', () => {
		const result = validateRegistrationForm(
			makeFormData({ ...validFormFields, userConsent: 'off' })
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fields).toMatchObject({ message: texts.errors.userConsentRequired });
	});

	it('fails when username is empty after trim', () => {
		const result = validateRegistrationForm(
			makeFormData({ ...validFormFields, username: '   ' })
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fields).toMatchObject({ message: texts.errors.usernameRequired });
	});

	it('accepts usernames with internal spaces (e.g. institution names)', () => {
		const result = validateRegistrationForm(
			makeFormData({ ...validFormFields, username: 'Ratsbücherei Lüneburg' })
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.username).toBe('Ratsbücherei Lüneburg');
	});

	it('collapses repeated internal whitespace', () => {
		const result = validateRegistrationForm(
			makeFormData({ ...validFormFields, username: 'AStA   Lüneburg' })
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.username).toBe('AStA Lüneburg');
	});

	it('fails when username is too short', () => {
		const result = validateRegistrationForm(
			makeFormData({ ...validFormFields, username: 'ab' })
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fields).toMatchObject({ message: texts.errors.usernameTooShort });
	});

	it('fails when username is too long', () => {
		const result = validateRegistrationForm(
			makeFormData({ ...validFormFields, username: 'a'.repeat(USERNAME_MAX_LENGTH + 1) })
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fields).toMatchObject({ message: texts.errors.usernameTooLong });
	});

	it('fails when username contains invalid characters', () => {
		const result = validateRegistrationForm(
			makeFormData({ ...validFormFields, username: 'user@name' })
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fields).toMatchObject({ message: texts.errors.usernameInvalidFormat });
	});
});

// ---------------------------------------------------------------------------
// resolveInviter
// ---------------------------------------------------------------------------

describe('resolveInviter', () => {
	it('returns null when inviteCode is null', async () => {
		const pb = makeMockPb(() => ({}));
		expect(await resolveInviter(pb, null)).toBeNull();
	});

	it('returns the user when invite code matches', async () => {
		const mockSend = vi.fn().mockResolvedValue({ id: 'u1', username: 'inviter' });
		const pb = makeMockPb(() => ({}), mockSend);
		const result = await resolveInviter(pb, 'valid-code');
		expect(result).toEqual({ id: 'u1', username: 'inviter' });
		expect(mockSend).toHaveBeenCalledWith('/api/invite/valid-code', { method: 'GET' });
	});

	it('returns null when invite code is not found', async () => {
		const mockSend = vi.fn().mockRejectedValue(new Error('not found'));
		const pb = makeMockPb(() => ({}), mockSend);
		expect(await resolveInviter(pb, 'bad-code')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// buildCreateUserPayload
// ---------------------------------------------------------------------------

describe('buildCreateUserPayload', () => {
	const fields = { email: 'a@b.com', password: 'pw12345678', username: 'alice' };

	it('includes all required fields with passwordConfirm', () => {
		const payload = buildCreateUserPayload(fields, 'newcode', null);
		expect(payload).toMatchObject({
			email: 'a@b.com',
			password: 'pw12345678',
			passwordConfirm: 'pw12345678',
			username: 'alice',
			inviteCode: 'newcode',
		});
		expect(payload.invitedBy).toBeUndefined();
	});

	it('includes invitedBy when inviterId is provided', () => {
		const payload = buildCreateUserPayload(fields, 'newcode', 'inviter-id');
		expect(payload.invitedBy).toBe('inviter-id');
	});

	it('omits invitedBy when inviterId is null', () => {
		const payload = buildCreateUserPayload(fields, 'newcode', null);
		expect('invitedBy' in payload).toBe(false);
	});

	it('does NOT set the legal version cache (server-only — Issue #399, review #1)', () => {
		// The version fields are stamped server-side by the backend users-create hook,
		// never from the client payload, so the consent gate can't be pre-empted.
		const payload = buildCreateUserPayload(fields, 'newcode', null);
		expect('tosAcceptedVersion' in payload).toBe(false);
		expect('privacyAcceptedVersion' in payload).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// createUserAndAuthenticate
// ---------------------------------------------------------------------------

describe('createUserAndAuthenticate', () => {
	const payload = { email: 'a@b.com', password: 'pw', passwordConfirm: 'pw', username: 'newuser', inviteCode: 'x' };

	it('returns ok with user on success', async () => {
		const mockCreate = vi.fn().mockResolvedValue(stubUser);
		const mockAuth = vi.fn().mockResolvedValue({});
		const pb = makeMockPb(() => ({ create: mockCreate, authWithPassword: mockAuth }));
		const result = await createUserAndAuthenticate(pb, payload, 'a@b.com', 'pw');
		expect(result).toEqual({ ok: true, user: stubUser });
		expect(mockAuth).toHaveBeenCalledWith('a@b.com', 'pw');
	});

	it('returns email_taken for duplicate email error', async () => {
		const mockCreate = vi.fn().mockRejectedValue({
			status: 400,
			data: { data: { email: { code: 'validation_not_unique' } } },
		});
		const pb = makeMockPb(() => ({ create: mockCreate }));
		const result = await createUserAndAuthenticate(pb, payload, 'a@b.com', 'pw');
		expect(result).toEqual({ ok: false, error: 'email_taken' });
	});

	it('returns username_taken for duplicate username error', async () => {
		const mockCreate = vi.fn().mockRejectedValue({
			status: 400,
			data: { data: { username: { code: 'validation_not_unique' } } },
		});
		const pb = makeMockPb(() => ({ create: mockCreate }));
		const result = await createUserAndAuthenticate(pb, payload, 'a@b.com', 'pw');
		expect(result).toEqual({ ok: false, error: 'username_taken' });
	});

	it('returns unknown for unexpected errors', async () => {
		const mockCreate = vi.fn().mockRejectedValue({ status: 500, data: {} });
		const pb = makeMockPb(() => ({ create: mockCreate }));
		const result = await createUserAndAuthenticate(pb, payload, 'a@b.com', 'pw');
		expect(result).toEqual({ ok: false, error: 'unknown' });
	});
});
