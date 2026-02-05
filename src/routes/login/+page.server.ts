import { error, fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';

export async function load({ locals }) {
	if (locals.user) {
		redirect(303, '/');
	}

	return {};
}

export const actions = {
	login: async ({ locals, request }) => {
		const data = await request.formData();
		const email = data.get('email');
		const password = data.get('password');

		if (!email || !password) {
			return fail(400, {
				fail: true,
				emailRequired: email === null,
				passwordRequired: password === null,
			});
		}

		try {
			await locals.pb
				.collection('users')
				.authWithPassword(email.toString(), password.toString()); // TODO: Is this encrypted / does it need to be?
		} catch (err) {
			// if error is "failed to authenticate", display error message
			console.error('Failed to login', err);
			const e = err as Partial<ClientResponseError>;

			if (e?.status == 400) {
				return fail(400, {
					fail: true,
					message: 'Login fehlgeschlagen.',
				});
			} else {
				error(e.status ?? 500, 'Unable to login.');
			}
		}
		redirect(303, '/');
	},
};
