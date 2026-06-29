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

describe('profile saveProfile — email-contact opt-in (#438)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('persists contactViaEmail + contactEmail on the users record', async () => {
		const { result, usersUpdate } = callSave({
			contactViaEmail: 'on',
			contactEmail: 'verleih@asta-lueneburg.de',
		});

		await expect(result).resolves.toMatchObject({ success: true });
		expect(usersUpdate).toHaveBeenCalledTimes(1);
		const sent = usersUpdate.mock.calls[0][1] as FormData;
		expect(sent.get('contactViaEmail')).toBe('true');
		expect(sent.get('contactEmail')).toBe('verleih@asta-lueneburg.de');
	});

	it('rejects enabling the toggle without an address', async () => {
		const { result, usersUpdate } = callSave({ contactViaEmail: 'on', contactEmail: '  ' });

		await expect(result).resolves.toMatchObject({
			error: true,
			message: texts.errors.contactEmailRequired,
		});
		expect(usersUpdate).not.toHaveBeenCalled();
	});

	it('rejects a malformed contact email', async () => {
		const { result, usersUpdate } = callSave({
			contactViaEmail: 'on',
			contactEmail: 'not-an-email',
		});

		await expect(result).resolves.toMatchObject({
			error: true,
			message: texts.errors.invalidContactEmail,
		});
		expect(usersUpdate).not.toHaveBeenCalled();
	});

	it('saves the address but with the toggle off when the checkbox is unchecked', async () => {
		// An unchecked checkbox is simply absent from the form data.
		const { result, usersUpdate } = callSave({ contactEmail: 'verleih@asta-lueneburg.de' });

		await expect(result).resolves.toMatchObject({ success: true });
		const sent = usersUpdate.mock.calls[0][1] as FormData;
		expect(sent.get('contactViaEmail')).toBe('false');
		expect(sent.get('contactEmail')).toBe('verleih@asta-lueneburg.de');
	});

	it('clears a previously-set address when toggle off + empty field are submitted', async () => {
		// No contact fields in the form → both are written as off/empty, erasing any
		// stored address (the fields are written unconditionally).
		const { result, usersUpdate } = callSave({});

		await expect(result).resolves.toMatchObject({ success: true });
		const sent = usersUpdate.mock.calls[0][1] as FormData;
		expect(sent.get('contactViaEmail')).toBe('false');
		expect(sent.get('contactEmail')).toBe('');
	});
});
