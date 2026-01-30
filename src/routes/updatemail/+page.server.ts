import { fail } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';




export const actions = {
	updatemail: async ({ locals, request }) => {

		const data = await request.formData();
		const email = data.get('newEmail');

		if (!email) {
			return fail(400, { emailRequired: email === null });
		}

		try {
			await locals.pb.collection('users').requestEmailChange(email.toString());
		} catch (error) {
			const errorObj = error as ClientResponseError;
			return fail(500, { fail: true, message: errorObj.data.message });
		}

		
		return {
			success: true
		};
	}
};
