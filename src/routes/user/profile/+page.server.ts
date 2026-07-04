import { PUBLIC_PB_URL } from '../../../hooks.server';
import { texts } from '$lib/texts';
import { generateInviteSlug } from '$lib/inviteSlug';
import { upsertUserGeolocation } from '$lib/server/geolocation';
import { normalizeUsername, validateUsername } from '$lib/utils/username';
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

		// Username: normalize (trim + collapse internal whitespace) and validate against
		// the shared rules before writing. Empty means "left unchanged", so skip it.
		const username = normalizeUsername(formData?.get('username')?.toString() ?? '');
		if (username !== '') {
			switch (validateUsername(username)) {
				case 'too_short':
					return { error: true, message: texts.errors.usernameTooShort };
				case 'too_long':
					return { error: true, message: texts.errors.usernameTooLong };
				case 'invalid':
					return { error: true, message: texts.errors.usernameInvalidFormat };
			}
			updateData['username'] = username;
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

		// Off-platform-contact opt-in (issue #438) → stored on the `users` record (not
		// user_contacts). contactMethod ('email' | 'link') turns the item CTA into a
		// mailto: to contactEmail or a link to contactUrl; '' keeps the in-app flow.
		// contactPublic exposes the CTA to unauthenticated browsing. contactEmail stays
		// separate from the private login `email`.
		const rawMethod = formData?.get('contactMethod')?.toString() ?? '';
		const contactMethod = rawMethod === 'email' || rawMethod === 'link' ? rawMethod : '';
		const submittedEmail = (formData?.get('contactEmail')?.toString() ?? '').trim();
		const submittedUrl = (formData?.get('contactUrl')?.toString() ?? '').trim();
		const contactPublic = contactMethod !== '' && formData?.get('contactPublic') === 'on';
		// Persist only the ACTIVE method's target and clear the other, so no stale
		// off-platform handle lingers on the record (it would otherwise stay readable by
		// any logged-in viewer of the owner) — and so validation only ever runs against
		// the field that will actually be used.
		const contactEmail = contactMethod === 'email' ? submittedEmail : '';
		const contactUrl = contactMethod === 'link' ? submittedUrl : '';
		if (contactMethod === 'email') {
			if (contactEmail === '') {
				return { error: true, message: texts.errors.contactEmailRequired };
			}
			// Practical email shape that also excludes URL-significant characters (?, &, %,
			// quotes, spaces) so the address can't smuggle extra params into the mailto:
			// CTA. PocketBase's email field is the authoritative validator; this is UX + a
			// belt-and-braces guard alongside the per-part encoding in buildMailtoHref().
			if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(contactEmail)) {
				return { error: true, message: texts.errors.invalidContactEmail };
			}
		}
		if (contactMethod === 'link') {
			if (contactUrl === '') {
				return { error: true, message: texts.errors.contactUrlRequired };
			}
			// Only https links are allowed. Case-sensitive on purpose: the /api/redirect
			// guard the CTA routes through checks `startsWith('https://')`, so accepting an
			// upper/mixed-case scheme here would store a link that 400s at click time.
			if (!/^https:\/\/[^\s?#]+/.test(contactUrl)) {
				return { error: true, message: texts.errors.invalidContactUrl };
			}
		}
		updateData['contactMethod'] = contactMethod;
		updateData['contactEmail'] = contactEmail;
		updateData['contactUrl'] = contactUrl;
		updateData['contactPublic'] = contactPublic;

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

		// Deferred profile-image removal (ProfileImageField sets this): clear the image on
		// save unless a new one was also picked (a new upload wins).
		if (formData?.get('removeProfileImage') === 'true' && !hasProfileImage) {
			updateData['profileImage'] = null;
		}

		// Handle lender-defined borrower requirements (#443). The toggles live in the
		// same settings form, so the single save bar persists them too. Built from the
		// registry so a new requirement type needs no change here.
		const requirementData = Object.fromEntries(
			requirementFields.map((field) => [field, formData.get(field) === 'on'])
		);

		try {
			const hasUserUpdate = Object.keys(updateData).length > 0 || hasProfileImage;
			// Primary profile fields first, so a failure in the always-written side data
			// (contact/requirements) below can't silently skip the user's main edits.
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
			// Contact + requirements are always written, so clicking "Speichern" never
			// returns a spurious "nothing to update".
			await upsertOwnContact(locals.pb, locals.user.id, contact);
			await upsertOwnerRequirements(locals.pb, locals.user.id, requirementData);
			return {
				success: true,
				message: texts.success.dataUpdated,
			};
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: Error | any) {
			console.error('saveProfile failed', err);
			return {
				error: true,
				message: texts.pages.profile.cannotUpdate + (err ? ` Fehler: ${err.message}` : ''),
			};
		}
	},
};
