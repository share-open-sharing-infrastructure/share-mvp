import { PUBLIC_PB_URL } from '../../../hooks.server';
import { texts } from '$lib/texts';
import { generateInviteSlug } from '$lib/inviteSlug';
import { upsertUserGeolocation } from '$lib/server/geolocation';

export async function load({ locals, url }) {
	// Fetch directly so the profile page always has fresh data regardless of
	// whether the root layout's currentUser was served from a navigation cache.
	const currentUser = await locals.pb.collection('users').getOne(locals.user.id);

	let inviteCode = currentUser.inviteCode as string | undefined;

	if (!inviteCode) {
		inviteCode = await generateInviteSlug(locals.pb);
		await locals.pb.collection('users').update(locals.user.id, { inviteCode });
	}

	const inviteUrl = `${url.origin}/invite/${inviteCode}`;

	return {
		PB_URL: PUBLIC_PB_URL,
		inviteUrl,
		currentUser,
	};
}

export const actions = {
	deleteProfileImage: async ({ locals }) => {
		try {
			await locals.pb.collection('users').update(locals.user.id, { profileImage: null });
			return { success: true, message: texts.success.dataUpdated };
		} catch {
			return { error: true, message: texts.errors.somethingWentWrong };
		}
	},

	resendVerification: async ({ locals }) => {
		try {
			await locals.pb.collection('users').requestVerification(locals.user.email);
			return { success: true, message: texts.pages.profile.verificationSent };
		} catch {
			return { error: true, message: texts.errors.somethingWentWrong };
		}
	},

	saveProfile: async ({ locals, request }) => {
		const formData = await request.formData();

		// Use a FormData object for the PocketBase update so file uploads are handled correctly
		const pbFormData = new FormData();

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
		if(city || city === '') {
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

		// Handle geolocation → owner-only user_geolocations collection
		// (undefined = leave unchanged; only set when a geocode suggestion was picked).
		let geo: { lon: number; lat: number } | null | undefined;
		const geoLon = formData?.get('geolocation_lon')?.toString();
		const geoLat = formData?.get('geolocation_lat')?.toString();
		if (geoLon && geoLat) {
			const lon = parseFloat(geoLon);
			const lat = parseFloat(geoLat);
			if (!isNaN(lon) && !isNaN(lat)) {
				geo = { lon, lat };
			}
		} else if (city === ''){
			// If city is cleared, also clear geolocation
			geo = null;
		}

		// Handle preferred transport mode
		const preferredTransportMode = formData?.get('preferredTransportMode')?.toString();
		if (preferredTransportMode === 'foot' || preferredTransportMode === 'bicycle' || preferredTransportMode === 'car') {
			updateData['preferredTransportMode'] = preferredTransportMode;
		}

		// Handle bio
		const bio = formData?.get('bio')?.toString();
		if (bio !== undefined) {
			updateData['bio'] = bio.trim();
		}

		// Handle profileImage file upload
		const profileImageFile = formData?.get('profileImage');
		const hasProfileImage = profileImageFile instanceof File && profileImageFile.size > 0;

		try {
			const hasUserUpdate = Object.keys(updateData).length > 0 || hasProfileImage;
			if (hasUserUpdate || geo !== undefined) {
				if (hasUserUpdate) {
					// Build a FormData for PocketBase so file uploads work correctly alongside scalar fields
					for (const [key, value] of Object.entries(updateData)) {
						if (value === null) {
							pbFormData.append(key, '');
						} else if (typeof value === 'object') {
							pbFormData.append(key, JSON.stringify(value));
						} else {
							pbFormData.append(key, String(value));
						}
					}
					if (hasProfileImage) {
						pbFormData.append('profileImage', profileImageFile as File);
					}
					await locals.pb.collection('users').update(locals.user.id, pbFormData);
				}
				if (geo !== undefined) {
					await upsertUserGeolocation(locals.pb, locals.user.id, geo);
				}
				return {
					success: true,
					message: texts.success.dataUpdated,
				};
			} else {
				return {
					error: true,
					message: texts.pages.profile.cannotUpdate,
				};
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: Error | any) {
			return {
				error: true,
				message: texts.pages.profile.cannotUpdate + (err ? ` Fehler: ${err.message}` : ''),
			};
		}
	},
};
