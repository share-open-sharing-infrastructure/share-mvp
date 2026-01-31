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
			return {
				error: true,
				message: (error as ClientResponseError).message || 'Ein unbekannter Fehler ist aufgetreten.'
			};
		}


		return {
			success: true,
			message: `Eine Bestätigungs-E-Mail wurde an deine neue Adresse ${email} gesendet. Bitte überprüfe deinen Posteingang.`
		};
	}
};
