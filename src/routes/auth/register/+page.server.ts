import { fail, redirect } from '@sveltejs/kit';
import { texts } from '$lib/texts';
import type { User } from '$lib/types/models';
import { generateInviteSlug } from '$lib/inviteSlug';
import {
	validateRegistrationForm,
	resolveInviter,
	buildCreateUserPayload,
	createUserAndAuthenticate,
	requestEmailVerification,
	signUpForNewsletter,
	handleInviterRelationship,
} from '$lib/server/registration';

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
			.collection('users_public')
			.getFirstListItem<User>(locals.pb.filter('inviteCode = {:code}', { code: inviteCode }));
		return { inviter: { id: inviter.id, username: inviter.username }, inviteCode };
	} catch {
		return { inviter: null, inviteCode };
	}
}

export const actions = {
	register: async ({ locals, request }) => {
		const data = await request.formData();

		const validation = validateRegistrationForm(data);
		if (!validation.ok) return fail(validation.status, validation.fields);

		const { email, password, username, subscribeToNewsletter, inviteCode: rawInviteCode } = validation;

		const [inviter, newInviteCode] = await Promise.all([
			resolveInviter(locals.pb, rawInviteCode),
			generateInviteSlug(locals.pb),
		]);

		const payload = buildCreateUserPayload({ email, password, username }, newInviteCode, inviter?.id ?? null);

		const result = await createUserAndAuthenticate(locals.pb, payload, email, password);
		if (!result.ok) {
			if (result.error === 'email_taken') return fail(400, { fail: true, message: texts.errors.emailAlreadyTaken });
			if (result.error === 'username_taken') return fail(400, { fail: true, message: texts.errors.usernameTaken });
			return fail(500, { fail: true, message: texts.errors.somethingWentWrong });
		}

		await requestEmailVerification(locals.pb, email);
		if (subscribeToNewsletter) await signUpForNewsletter(email, username);
		if (inviter) await handleInviterRelationship(locals.pb, result.user, inviter);

		redirect(303, '/onboarding');
	},
};
