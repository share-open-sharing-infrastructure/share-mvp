import { describe, it, expect, vi, beforeEach } from 'vitest';
import { texts } from '$lib/texts';

// hooks.server.ts (re-exported via +page.server's import chain) reads these.
vi.mock('$env/static/public', () => ({
	PUBLIC_PB_URL: 'http://localhost/',
	PUBLIC_VAPID_PUBLIC_KEY: 'x',
}));
// Module-level imports of +page.server that touch external state — stub them.
vi.mock('$lib/inviteSlug', () => ({ generateInviteSlug: vi.fn() }));
vi.mock('$lib/server/geolocation', () => ({ upsertUserGeolocation: vi.fn() }));
const { upsertOwnContact } = vi.hoisted(() => ({ upsertOwnContact: vi.fn() }));
vi.mock('$lib/server/contacts', () => ({ upsertOwnContact, getOwnContact: vi.fn() }));
vi.mock('$lib/server/lendingRequirements', () => ({
	getOwnerRequirements: vi.fn(),
	getRequirementSettings: vi.fn(),
	requirementFields: [],
	upsertOwnerRequirements: vi.fn(),
}));

import { actions } from './+page.server';

const USER_ID = 'u1';

function callSave(fields: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.set(k, v);
	const usersUpdate = vi.fn().mockResolvedValue({});
	const pb = { collection: vi.fn(() => ({ update: usersUpdate })) };
	const result = actions.saveProfile({
		locals: { pb, user: { id: USER_ID } },
		request: { formData: vi.fn().mockResolvedValue(fd) },
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any);
	return { result, usersUpdate };
}

describe('profile saveProfile — off-platform-contact opt-in (#438)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('persists an email contact (method + address) on the users record', async () => {
		const { result, usersUpdate } = callSave({
			contactMethod: 'email',
			contactEmail: 'verleih@asta-lueneburg.de',
			contactUrl: '',
			contactPublic: 'on',
		});

		await expect(result).resolves.toMatchObject({ success: true });
		expect(usersUpdate).toHaveBeenCalledTimes(1);
		const sent = usersUpdate.mock.calls[0][1] as FormData;
		expect(sent.get('contactMethod')).toBe('email');
		expect(sent.get('contactEmail')).toBe('verleih@asta-lueneburg.de');
		expect(sent.get('contactPublic')).toBe('true');
	});

	it('persists a link contact (method + url)', async () => {
		const { result, usersUpdate } = callSave({
			contactMethod: 'link',
			contactUrl: 'https://verleih.example/form',
		});

		await expect(result).resolves.toMatchObject({ success: true });
		const sent = usersUpdate.mock.calls[0][1] as FormData;
		expect(sent.get('contactMethod')).toBe('link');
		expect(sent.get('contactUrl')).toBe('https://verleih.example/form');
	});

	it('rejects the email method without an address', async () => {
		const { result, usersUpdate } = callSave({ contactMethod: 'email', contactEmail: '  ' });

		await expect(result).resolves.toMatchObject({
			error: true,
			message: texts.errors.contactEmailRequired,
		});
		expect(usersUpdate).not.toHaveBeenCalled();
	});

	it('rejects the link method without a url', async () => {
		const { result, usersUpdate } = callSave({ contactMethod: 'link', contactUrl: '  ' });

		await expect(result).resolves.toMatchObject({
			error: true,
			message: texts.errors.contactUrlRequired,
		});
		expect(usersUpdate).not.toHaveBeenCalled();
	});

	it('rejects a malformed contact email', async () => {
		const { result, usersUpdate } = callSave({
			contactMethod: 'email',
			contactEmail: 'not-an-email',
		});

		await expect(result).resolves.toMatchObject({
			error: true,
			message: texts.errors.invalidContactEmail,
		});
		expect(usersUpdate).not.toHaveBeenCalled();
	});

	it('rejects a non-https contact url', async () => {
		const { result, usersUpdate } = callSave({
			contactMethod: 'link',
			contactUrl: 'http://insecure.example/form',
		});

		await expect(result).resolves.toMatchObject({
			error: true,
			message: texts.errors.invalidContactUrl,
		});
		expect(usersUpdate).not.toHaveBeenCalled();
	});

	it('forces contactPublic off when the method is off', async () => {
		// contactPublic checkbox present but method off → public must be coerced to false.
		const { result, usersUpdate } = callSave({ contactPublic: 'on' });

		await expect(result).resolves.toMatchObject({ success: true });
		const sent = usersUpdate.mock.calls[0][1] as FormData;
		expect(sent.get('contactMethod')).toBe('');
		expect(sent.get('contactPublic')).toBe('false');
	});

	it('clears the contact fields when nothing is submitted', async () => {
		// No contact fields in the form → method off, fields empty, public off (written
		// unconditionally), erasing any stored values.
		const { result, usersUpdate } = callSave({});

		await expect(result).resolves.toMatchObject({ success: true });
		const sent = usersUpdate.mock.calls[0][1] as FormData;
		expect(sent.get('contactMethod')).toBe('');
		expect(sent.get('contactEmail')).toBe('');
		expect(sent.get('contactUrl')).toBe('');
		expect(sent.get('contactPublic')).toBe('false');
	});
});
