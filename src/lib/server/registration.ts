import type PocketBase from 'pocketbase';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import type { User } from '$lib/types/models';
import { createNotification, sendPushToUser } from '$lib/server/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RegistrationFields = {
	email: string;
	password: string;
	username: string;
	subscribeToNewsletter: boolean;
	inviteCode: string | null;
};

export type ValidationResult =
	| ({ ok: true } & RegistrationFields)
	| { ok: false; status: number; fields: Record<string, unknown> };

export type CreateUserResult = { ok: true; user: User } | { ok: false; error: 'email_taken' | 'username_taken' | 'unknown' };

// ---------------------------------------------------------------------------
// Form validation
// ---------------------------------------------------------------------------

const USERNAME_REGEX = /^[\w\p{L}][\w\p{L}.-]*$/u;

export function validateRegistrationForm(data: FormData): ValidationResult {
	const email = data.get('email');
	const password = data.get('password');

	if (!email || !password) {
		return { ok: false, status: 400, fields: { emailRequired: !email, passwordRequired: !password } };
	}

	if (password.toString().length < 8) {
		return { ok: false, status: 400, fields: { fail: true, message: texts.errors.passwordTooShort } };
	}

	if (data.get('userConsent') !== 'on') {
		return { ok: false, status: 400, fields: { fail: true, message: texts.errors.userConsentRequired } };
	}

	const username = data.get('username')?.toString().trim();
	if (!username) {
		return { ok: false, status: 400, fields: { fail: true, message: texts.errors.usernameRequired } };
	}
	if (username.includes(' ')) {
		return { ok: false, status: 400, fields: { fail: true, message: texts.errors.usernameNoSpaces } };
	}
	if (!USERNAME_REGEX.test(username)) {
		return { ok: false, status: 400, fields: { fail: true, message: texts.errors.usernameInvalidFormat } };
	}

	return {
		ok: true,
		email: email.toString(),
		password: password.toString(),
		username,
		subscribeToNewsletter: data.get('subscribeToNewsletter') === 'on',
		inviteCode: data.get('inviteCode')?.toString() ?? null,
	};
}

// ---------------------------------------------------------------------------
// Invite code lookup
// ---------------------------------------------------------------------------

export async function resolveInviter(pb: PocketBase, inviteCode: string | null): Promise<User | null> {
	if (!inviteCode) return null;
	try {
		return await pb.collection('users_public').getFirstListItem<User>(`inviteCode = "${inviteCode}"`);
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Payload assembly
// ---------------------------------------------------------------------------

export function buildCreateUserPayload(
	fields: Pick<RegistrationFields, 'email' | 'password' | 'username'>,
	newInviteCode: string,
	inviterId: string | null
): Record<string, unknown> {
	const payload: Record<string, unknown> = {
		email: fields.email,
		password: fields.password,
		passwordConfirm: fields.password,
		username: fields.username,
		inviteCode: newInviteCode,
	};
	if (inviterId) {
		payload.invitedBy = inviterId;
	}
	return payload;
}

// ---------------------------------------------------------------------------
// User creation
// ---------------------------------------------------------------------------

export async function createUserAndAuthenticate(
	pb: PocketBase,
	payload: Record<string, unknown>,
	email: string,
	password: string
): Promise<CreateUserResult> {
	try {
		const user = await pb.collection('users').create<User>(payload);
		await pb.collection('users').authWithPassword(email, password);
		return { ok: true, user };
	} catch (error) {
		const e = error as ClientResponseError;
		console.error('Registration error:', e);
		if (e.status === 400) {
			if (e.data?.data?.email?.code === 'validation_not_unique') return { ok: false, error: 'email_taken' };
			if (e.data?.data?.username?.code === 'validation_not_unique') return { ok: false, error: 'username_taken' };
		}
		return { ok: false, error: 'unknown' };
	}
}

// ---------------------------------------------------------------------------
// Non-fatal side effects
// ---------------------------------------------------------------------------

export async function requestEmailVerification(pb: PocketBase, email: string): Promise<void> {
	try {
		await pb.collection('users').requestVerification(email);
	} catch (error) {
		console.error('Failed to send verification email:', error);
	}
}

export async function signUpForNewsletter(email: string, username: string): Promise<void> {
	try {
		const body = new URLSearchParams();
		body.set('contact[email]', email);
		body.set('contact[first_name]', username);
		// Keila honeypot field — must be empty to pass bot detection.
		body.set('h[url]', '');
		await fetch('https://app.keila.io/forms/nfrm_b94Bj5RD', { method: 'POST', body });
	} catch (error) {
		console.error('Newsletter signup failed:', error);
	}
}

export async function handleInviterRelationship(pb: PocketBase, newUser: User, inviter: User): Promise<void> {
	try {
		await pb.collection('users').update(newUser.id, { trusts: [inviter.id] });
	} catch (error) {
		console.error('Failed to set new user trust:', error);
	}

	const body = texts.notifications.inviteAccepted(newUser.username);
	await createNotification(pb, inviter.id, newUser.id, 'invite_accepted', newUser.id, body);
	await sendPushToUser(pb, inviter.id, texts.notifications.pushTitle, body, `/users/${newUser.id}`);
}
