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

		if (!token) {
			return fail(400, { fail: true, message: texts.errors.invalidOrExpiredVerificationToken });
		}

		try {
			await locals.pb.collection('users').confirmVerification(token.toString());
		} catch (error) {
			const errorObj = error as ClientResponseError;
			console.error('Email verification confirmation error:', errorObj);
			return fail(400, { fail: true, message: texts.errors.invalidOrExpiredVerificationToken });
		}

		setFlash(cookies, texts.success.emailVerified);
		redirect(303, '/auth/login');
	},
};
