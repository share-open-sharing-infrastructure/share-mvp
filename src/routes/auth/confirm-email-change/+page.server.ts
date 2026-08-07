import { fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import { setFlash } from '$lib/server/flash';

export async function load({ url }) {
	return { token: url.searchParams.get('token') };
}

export const actions = {
	confirm: async ({ locals, request, cookies }) => {
		const data = await request.formData();
		const token = data.get('token');
		const password = data.get('password');

		if (!token) {
			return fail(400, { fail: true, message: texts.errors.invalidOrExpiredEmailChangeToken });
		}

		if (!password) {
			return fail(400, { fail: true, message: texts.errors.passwordRequired });
		}

		try {
			await locals.pb
				.collection('users')
				.confirmEmailChange(token.toString(), password.toString());
		} catch (error) {
			const errorObj = error as ClientResponseError;
			console.error('Email change confirmation error:', errorObj);
			return fail(400, { fail: true, message: texts.errors.emailChangeFailed });
		}

		setFlash(cookies, texts.success.emailChanged);
		redirect(303, '/auth/login');
	},
};
