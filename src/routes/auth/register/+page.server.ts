import { fail, redirect } from '@sveltejs/kit';
import { texts } from '$lib/texts';
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
import { getActiveLegalDocs } from '$lib/server/legalDocs';

export async function load({ locals, url }) {
	if (locals.user) {
		return redirect(303, '/');
	}

	// Active legal documents for the consent-checkbox label + the inline reader modals
	// (shown in-app rather than a new tab, which is unusable in the PWA). Fail-open: a
	// transient DB error must not take down the whole signup page — consent is still
	// enforced server-side by the users-create hook (#399, review round 2 / #4).
	let legalDocs: Awaited<ReturnType<typeof getActiveLegalDocs>> = [];
	try {
		legalDocs = await getActiveLegalDocs(locals.pb);
	} catch (err) {
		console.error('failed to load legal documents for register page:', err);
	}

	const inviteCode = url.searchParams.get('invite');
	if (!inviteCode) {
		return { inviter: null, inviteCode: null, legalDocs };
	}

	try {
		const inviter = await locals.pb.send<{ id: string; username: string }>(
			`/api/invite/${encodeURIComponent(inviteCode)}`,
			{ method: 'GET' }
		);
		return { inviter: { id: inviter.id, username: inviter.username }, inviteCode, legalDocs };
	} catch {
		return { inviter: null, inviteCode, legalDocs };
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

		// Registration-time consent (version cache + immutable audit records) is set
		// server-side by the backend `legal.pb.js` users-create hook — see #399.

		await requestEmailVerification(locals.pb, email);
		if (subscribeToNewsletter) await signUpForNewsletter(email, username);
		if (inviter) await handleInviterRelationship(locals.pb, result.user, inviter);

		redirect(303, '/onboarding');
	},
};
