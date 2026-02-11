import { fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';

export async function load({ locals }) {
	if (locals.user) {
		return redirect(303, '/');
	}

	return {};
}

export const actions = {
	reset: async ({ locals, request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email');

		if (!email) {
			return fail(400, { emailRequired: email === null });
		}

		try {
			await locals.pb
				.collection('users')
				.requestPasswordReset(email.toString());
		} catch (error) {
			const errorObj = error as ClientResponseError;
			return fail(500, {
				fail: true,
				message: errorObj.data.message ?? texts.errors.somethingWentWrong,
			});
		}

		// universal flash pattern:
		cookies.set(
			'flash',
			JSON.stringify({
				type: 'success',
				message: texts.success.passwordResetSent,
			}),
			{
				path: '/',
				maxAge: 60, // seconds
			}
		);
		redirect(303, '/auth/login');
	},
};
