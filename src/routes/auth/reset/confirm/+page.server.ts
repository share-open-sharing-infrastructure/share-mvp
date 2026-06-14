import { fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';

export async function load({ url }) {
	return { token: url.searchParams.get('token') };
}

export const actions = {
	confirm: async ({ locals, request, cookies }) => {
		const data = await request.formData();
		const token = data.get('token');
		const password = data.get('password');
		const passwordConfirm = data.get('passwordConfirm');

		if (!token) {
			return fail(400, { fail: true, message: texts.errors.invalidOrExpiredResetToken });
		}

		if (!password || !passwordConfirm) {
			return fail(400, { fail: true, message: texts.errors.somethingWentWrong });
		}

		if (password.toString().length < 8) {
			return fail(400, { fail: true, message: texts.errors.passwordTooShort });
		}

		if (password.toString() !== passwordConfirm.toString()) {
			return fail(400, { fail: true, message: texts.errors.passwordsDoNotMatch });
		}

		try {
			await locals.pb
				.collection('users')
				.confirmPasswordReset(token.toString(), password.toString(), passwordConfirm.toString());
		} catch (error) {
			const errorObj = error as ClientResponseError;
			console.error('Password reset confirmation error:', errorObj);
			return fail(400, { fail: true, message: texts.errors.invalidOrExpiredResetToken });
		}

		// universal flash pattern:
		cookies.set(
			'flash',
			JSON.stringify({
				type: 'success',
				message: texts.success.passwordResetConfirmed,
			}),
			{
				path: '/',
				maxAge: 60, // seconds
			}
		);
		redirect(303, '/auth/login');
	},
};
