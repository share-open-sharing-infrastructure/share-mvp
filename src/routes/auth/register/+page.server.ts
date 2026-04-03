import { fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import type { User } from '$lib/types/models';
import { createNotification, sendPushToUser } from '$lib/server/notifications';

export async function load({ locals, url }) {
	if (locals.user) {
		return redirect(303, '/');
	}

	const inviteCode = url.searchParams.get('invite');
	if (!inviteCode) {
		return { inviter: null, inviteCode: null };
	}

	try {
		const inviter = await locals.pb
			.collection('users')
			.getFirstListItem<User>(`inviteCode = "${inviteCode}"`);
		return { inviter: { id: inviter.id, username: inviter.username }, inviteCode };
	} catch {
		return { inviter: null, inviteCode };
	}
}

export const actions = {
	register: async ({ locals, request }) => {
		const data = await request.formData();
		const email = data.get('email');
		const password = data.get('password');
		const inviteCode = data.get('inviteCode')?.toString();

		// Validate invite code
		if (!inviteCode) {
			return fail(400, { fail: true, message: texts.pages.invite.invalidInvite });
		}

		let inviter: User;
		try {
			inviter = await locals.pb
				.collection('users')
				.getFirstListItem<User>(`inviteCode = "${inviteCode}"`);
		} catch {
			return fail(400, { fail: true, message: texts.pages.invite.invalidInvite });
		}

		if (!email || !password) {
			return fail(400, {
				emailRequired: email === null,
				passwordRequired: password === null,
			});
		}

		if (password.toString().length < 8) {
			return fail(400, { fail: true, message: texts.errors.passwordTooShort });
		}

		const newInviteCode = crypto.randomUUID();
		data.set('passwordConfirm', password.toString()); // TODO: Put into form eventually
		data.set('inviteCode', newInviteCode);
		data.set('invitedBy', inviter.id);

		let newUser: User;
		try {
			newUser = await locals.pb.collection('users').create<User>(data);
			await locals.pb
				.collection('users')
				.authWithPassword(email.toString(), password.toString());
			await locals.pb.collection('users').requestVerification(email.toString());
		} catch (error) {
			const errorObj = error as ClientResponseError;
			return fail(500, {
				fail: true,
				message: errorObj.data.message ?? texts.errors.somethingWentWrong,
			});
		}

		// New user automatically trusts the inviter
		try {
			await locals.pb.collection('users').update(newUser.id, { trusts: [inviter.id] });
		} catch (error) {
			console.error('Failed to set new user trust:', error);
		}

		// Notify inviter so they can choose to trust back
		const body = texts.notifications.inviteAccepted(newUser.username);
		await createNotification(locals.pb, inviter.id, 'invite_accepted', newUser.id, body);
		await sendPushToUser(locals.pb, inviter.id, texts.notifications.pushTitle, body, `/users/${newUser.id}`);

		redirect(303, '/');
	},
};
