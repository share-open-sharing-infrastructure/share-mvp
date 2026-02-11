import { PUBLIC_PB_URL } from '../../../hooks.server';
import { texts } from '$lib/texts';

export async function load() {
	return {
		PB_URL: PUBLIC_PB_URL,
	};
}

export const actions = {
	saveProfile: async ({ locals, request }) => {
		const formData = await request.formData();

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const updateData: Record<string, any> = {};

		// Get username separately to check for spaces
		const username = formData?.get('username')?.toString();
		if (username) {
			const trimmedUsername = username.trim();
			if (trimmedUsername.includes(' ')) {
				return {
					error: true,
					message: texts.errors.usernameNoSpaces,
				};
			} else if (trimmedUsername !== '') {
				updateData['username'] = trimmedUsername;
			}
		}

		// Handle other fields
		const city = formData?.get('city')?.toString();
		if (city && city.trim() !== '') {
			updateData['city'] = city.trim();
		}

		try {
			if (Object.keys(updateData).length > 0) {
				await locals.pb.collection('users').update(locals.user.id, updateData);
				return {
					success: true,
					message: texts.success.dataUpdated,
				};
			} else {
				return {
					error: true,
					message:
						'Daten konnten nicht aktualisiert werden. Bitte überprüfen Sie Ihre Eingaben.',
				};
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: Error | any) {
			return {
				error: true,
				message:
					'Daten konnten nicht aktualisiert werden. Bitte überprüfen Sie Ihre Eingaben.' +
					(err ? ` Fehler: ${err.message}` : ''),
			};
		}
	},
};
