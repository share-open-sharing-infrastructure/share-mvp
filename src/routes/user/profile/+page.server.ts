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

		// Handle Telegram username
		const telegramUsername = formData?.get('telegramUsername')?.toString();
		if (telegramUsername) {
			const trimmedTelegram = telegramUsername.trim();
			if (trimmedTelegram !== '') {
				// Strip @ prefix if provided
				const cleanedTelegram = trimmedTelegram.startsWith('@')
					? trimmedTelegram.slice(1)
					: trimmedTelegram;

				// Validate Telegram username (alphanumeric and underscore only, 5-32 chars)
				if (!/^[a-zA-Z0-9_]{5,32}$/.test(cleanedTelegram)) {
					return {
						error: true,
						message: texts.errors.invalidTelegramUsername,
					};
				}
				updateData['telegramUsername'] = cleanedTelegram;
			} else {
				updateData['telegramUsername'] = null;
			}
		}

		// Handle Telegram visibility toggle
		const telegramVisibleToTrustedOnly =
			formData?.get('telegramVisibleToTrustedOnly') === 'on';
		updateData['telegramVisibleToTrustedOnly'] = telegramVisibleToTrustedOnly;

		// Handle Signal link
		const signalLink = formData?.get('signalLink')?.toString();
		if (signalLink) {
			const trimmedSignal = signalLink.trim();
			if (trimmedSignal !== '') {
				// Validate Signal link format (should contain signal.me or similar)
				if (!trimmedSignal.includes('signal.me')) {
					return {
						error: true,
						message: texts.errors.invalidSignalLink,
					};
				}
				updateData['signalLink'] = trimmedSignal;
			} else {
				updateData['signalLink'] = null;
			}
		}

		// Handle Signal visibility toggle
		const signalVisibleToTrustedOnly =
			formData?.get('signalVisibleToTrustedOnly') === 'on';
		updateData['signalVisibleToTrustedOnly'] = signalVisibleToTrustedOnly;

		// Handle geolocation (only set when user explicitly selected a geocode suggestion)
		const geoLon = formData?.get('geolocation_lon')?.toString();
		const geoLat = formData?.get('geolocation_lat')?.toString();
		if (geoLon && geoLat) {
			const lon = parseFloat(geoLon);
			const lat = parseFloat(geoLat);
			if (!isNaN(lon) && !isNaN(lat)) {
				updateData['geolocation'] = { lon, lat };
			}
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
