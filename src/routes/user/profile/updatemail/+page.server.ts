import { fail } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { normalizeEmail } from '$lib/server/email';

export const actions = {
	updatemail: async ({ locals, request }) => {
		const data = await request.formData();
		const email = data.get('newEmail');

		if (!email) {
			return fail(400, { emailRequired: email === null });
		}

		// Normalize before it reaches PocketBase so the stored email stays lowercase
		// and a later login/reset lookup matches (#557).
		const normalizedEmail = normalizeEmail(email.toString());

		try {
			await locals.pb.collection('users').requestEmailChange(normalizedEmail);

			return {
				success: true,
				message: `Eine Bestätigungs-E-Mail wurde an deine neue Adresse ${normalizedEmail} gesendet. Bitte überprüfe deinen Posteingang.`,
			};
		} catch (error) {
			console.error(error);
			return {
				error: true,
				message:
					(error as ClientResponseError).message ||
					"Ein unbekannter Fehler ist aufgetreten. Versuche es nochmal, oder komm' später wieder.",
			};
		}
	},
};
