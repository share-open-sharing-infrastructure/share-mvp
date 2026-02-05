import { fail, redirect } from '@sveltejs/kit';
import { LOGIN_SECRET } from '$env/static/private';
import type { ClientResponseError } from 'pocketbase';

export async function load({ locals }) {
	if (locals.user) {
		redirect(303, '/');
	}

	return {};
}

export const actions = {
	register: async ({ locals, request }) => {
		const data = await request.formData();
		const email = data.get('email');
		const password = data.get('password');
		const secret = data.get('secret');

		if (secret.toString() !== LOGIN_SECRET) {
			const error = 'Das eingegebene Geheimnis ist ungültig.';
			return fail(500, { fail: true, message: error });
		}

		if (!email || !password) {
			return fail(400, {
				emailRequired: email === null,
				passwordRequired: password === null,
			});
		}

		if (password.toString().length < 8) {
			const error = 'Das Passwort muss mindestens 8 Zeichen lang sein.';
			return fail(500, { fail: true, message: error });
		}

		data.set('passwordConfirm', password?.toString()); // TODO: Put into form eventually
		try {
			await locals.pb.collection('users').create(data);
			await locals.pb
				.collection('users')
				.authWithPassword(email.toString(), password.toString());
			await locals.pb.collection('users').requestVerification(email.toString());
		} catch (error) {
			const errorObj = error as ClientResponseError;
			return fail(500, { fail: true, message: errorObj.data.message });
		}

		redirect(303, '/');
	},
};
