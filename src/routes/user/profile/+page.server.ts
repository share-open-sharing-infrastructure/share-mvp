import { pbUrl } from '$lib/publicEnv';
import { texts } from '$lib/texts';
import { generateInviteSlug } from '$lib/inviteSlug';
import { upsertUserGeolocation } from '$lib/server/geolocation';
import { upsertOwnContact, getOwnContact } from '$lib/server/contacts';
import {
	parseUsernameField,
	parseMessengerContact,
	parseOffPlatformContact,
	parseGeolocationFields,
	parseTransportMode,
} from '$lib/server/profileForm';
import {
	getOwnerRequirements,
	getRequirementSettings,
	requirementFields,
	upsertOwnerRequirements
} from '$lib/server/lendingRequirements';
import { getUserPreferences, upsertUserPreferences } from '$lib/server/userPreferences';

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
	// Fetch preferences fresh too (same freshness reason as currentUser above); returned
	// under the same key the layout uses so the page value wins for this route (#426).
	// Distinct requestKey from the layout's fetch to avoid PB SSR auto-cancellation.
	const currentUserPreferences = await getUserPreferences(
		locals.pb,
		locals.user.id,
		'user-preferences-profile'
	);

	return {
		PB_URL: pbUrl(),
		inviteUrl,
		currentUser,
		currentUserPreferences,
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

		// Each field group is parsed/validated by its own $lib/server/profileForm helper;
		// this action only sequences them and persists the results.
		const username = parseUsernameField(formData);
		if (!username.ok) return { error: true, message: username.message };
		if (username.value !== undefined) updateData['username'] = username.value;

		const city = formData?.get('city')?.toString();
		if(city || city === '') {
			updateData['city'] = city.trim();
		}

		// Messenger handles → owner-only user_contacts collection (not users)
		const messengerContact = parseMessengerContact(formData);
		if (!messengerContact.ok) return { error: true, message: messengerContact.message };
		const contact = messengerContact.value;

		// Off-platform-contact opt-in (#438) → stored on the `users` record.
		const offPlatform = parseOffPlatformContact(formData);
		if (!offPlatform.ok) return { error: true, message: offPlatform.message };
		Object.assign(updateData, offPlatform.value);

		// Geolocation → owner-only user_geolocations collection.
		const geo = parseGeolocationFields(formData, city);

		// Preferred transport mode → user_preferences sidecar (issue #426), not users.
		const preferredTransportMode = parseTransportMode(formData);

		// Handle bio
		const bio = formData?.get('bio')?.toString();
		if (bio !== undefined) {
			updateData['bio'] = bio.trim();
		}

		// External-item lending explanation (#368) → institutions only. Always written for
		// an institution (so clearing the override works and falls back to the default text);
		// capped at 1000 to mirror the DB field. Non-institutions never see the editor and
		// their save must not touch the field.
		if (locals.user?.isInstitution) {
			const externalLendingInfo = (formData?.get('externalLendingInfo')?.toString() ?? '')
				.trim()
				.slice(0, 1000);
			updateData['externalLendingInfo'] = externalLendingInfo;
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
			if (preferredTransportMode) {
				await upsertUserPreferences(locals.pb, locals.user.id, { preferredTransportMode });
			}
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

	// #607: replaces EmailNotificationForm.svelte's (under NotificationSettings.svelte) old
	// client-side PocketBase-SDK reads/writes with a real form action (both toggles auto-submit
	// this one action together). Checkbox
	// semantics: present + "on" = true, absent = false — matches the master-switch /
	// digest-only-opt-out fields upsertUserPreferences hardens against a blank create (#607 B2).
	saveNotificationPrefs: async ({ locals, request }) => {
		const formData = await request.formData();
		try {
			await upsertUserPreferences(locals.pb, locals.user.id, {
				emailNotifications: formData.get('emailNotifications') === 'on',
				digestEmails: formData.get('digestEmails') === 'on',
			});
			return { success: true, message: texts.success.dataUpdated };
		} catch (err) {
			console.error('saveNotificationPrefs failed', err);
			return { error: true, message: texts.errors.somethingWentWrong };
		}
	},
};
