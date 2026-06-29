import { PUBLIC_PB_URL } from '../../../hooks.server';
import { texts } from '$lib/texts';
import { generateInviteSlug } from '$lib/inviteSlug';
import { upsertUserGeolocation } from '$lib/server/geolocation';
import { upsertOwnContact, getOwnContact } from '$lib/server/contacts';
import {
	getOwnerRequirements,
	getRequirementSettings,
	requirementFields,
	upsertOwnerRequirements
} from '$lib/server/lendingRequirements';

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
	const contact = await getOwnContact(locals.pb, locals.user.id);
	const lendingRequirements = await getOwnerRequirements(locals.pb, locals.user.id);

	return {
		PB_URL: PUBLIC_PB_URL,
		inviteUrl,
		currentUser,
		contact,
		requirementSettings: getRequirementSettings(lendingRequirements),
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

	saveLendingRequirements: async ({ locals, request }) => {
		const formData = await request.formData();
		// Build the payload from the registry so a new requirement type needs no
		// change here — its toggle (name = field) is read automatically.
		const data = Object.fromEntries(
			requirementFields.map((field) => [field, formData.get(field) === 'on'])
		);
		try {
			await upsertOwnerRequirements(locals.pb, locals.user.id, data);
			return { success: true, message: texts.lendingRequirements.saved };
		} catch (err) {
			console.error('saveLendingRequirements failed', err);
			return { error: true, message: texts.lendingRequirements.saveError };
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

		// Handle contact fields → owner-only user_contacts collection (not users)
		const contact = {
			telegramUsername: '',
			signalLink: '',
			telegramVisibleToTrustedOnly: formData?.get('telegramVisibleToTrustedOnly') === 'on',
			signalVisibleToTrustedOnly: formData?.get('signalVisibleToTrustedOnly') === 'on',
		};

		const telegramUsername = formData?.get('telegramUsername')?.toString();
		if (telegramUsername && telegramUsername.trim() !== '') {
			const cleanedTelegram = telegramUsername.trim().startsWith('@')
				? telegramUsername.trim().slice(1)
				: telegramUsername.trim();
			// Validate Telegram username (alphanumeric and underscore only, 5-32 chars)
			if (!/^[a-zA-Z0-9_]{5,32}$/.test(cleanedTelegram)) {
				return { error: true, message: texts.errors.invalidTelegramUsername };
			}
			contact.telegramUsername = cleanedTelegram;
		}

		const signalLink = formData?.get('signalLink')?.toString();
		if (signalLink && signalLink.trim() !== '') {
			const trimmedSignal = signalLink.trim();
			// Validate Signal link format (should contain signal.me or similar)
			if (!trimmedSignal.includes('signal.me')) {
				return { error: true, message: texts.errors.invalidSignalLink };
			}
			contact.signalLink = trimmedSignal;
		}

		// Email-contact opt-in (issue #438) → stored on the `users` record (not
		// user_contacts): contactViaEmail makes the item CTA a mailto: link to
		// contactEmail. The toggle requires a valid address, else the mailto would
		// be broken. contactEmail stays separate from the private login `email`.
		const contactViaEmail = formData?.get('contactViaEmail') === 'on';
		const contactEmail = (formData?.get('contactEmail')?.toString() ?? '').trim();
		// Practical email shape that also excludes URL-significant characters (?, &, %,
		// quotes, spaces) so the address can't smuggle extra params into the mailto:
		// CTA. PocketBase's email field is the authoritative validator; this is UX + a
		// belt-and-braces guard alongside the per-part encoding in buildMailtoHref().
		if (contactEmail !== '' && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(contactEmail)) {
			return { error: true, message: texts.errors.invalidContactEmail };
		}
		if (contactViaEmail && contactEmail === '') {
			return { error: true, message: texts.errors.contactEmailRequired };
		}
		updateData['contactViaEmail'] = contactViaEmail;
		updateData['contactEmail'] = contactEmail;

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
			await upsertOwnContact(locals.pb, locals.user.id, contact);
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
