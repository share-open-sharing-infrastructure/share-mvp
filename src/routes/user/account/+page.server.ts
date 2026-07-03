import { fail, redirect } from '@sveltejs/kit';
import { texts } from '$lib/texts';
import type { ClientResponseError } from 'pocketbase';

export async function load({ locals }) {
	return {
		currentUser: locals.user,
	};
}

export const actions = {
	deleteAccount: async ({ locals, request }) => {
		const formData = await request.formData();
		const password = formData.get('password')?.toString() ?? '';

		if (!password) {
			return fail(400, { error: true, message: texts.account.delete.wrongPassword });
		}

		try {
			// Delegated to the backend hook (DELETE /api/account), which runs the
			// anonymization with superuser access and atomically. pb.send attaches the
			// current auth token.
			await locals.pb.send('/api/account', {
				method: 'DELETE',
				body: { password },
			});
		} catch (err) {
			const e = err as ClientResponseError;
			const code = (e.response as { code?: string })?.code;
			if (e.status === 400 || code === 'invalid_password') {
				return fail(400, { error: true, message: texts.account.delete.wrongPassword });
			}
			if (e.status === 409 || code === 'active_loans') {
				return fail(409, { error: true, message: texts.account.delete.activeLoansBlocked });
			}
			console.error('Account deletion failed', err);
			return fail(500, { error: true, message: texts.account.delete.genericError });
		}

		// Account is gone — drop the session so the cleared auth cookie is written by
		// the authentication hook on this response.
		locals.pb.authStore.clear();
		locals.user = null;

		redirect(303, '/auth/account-deleted');
	},
};
