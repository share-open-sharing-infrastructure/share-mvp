/* eslint-disable @typescript-eslint/no-explicit-any */
import { fail } from '@sveltejs/kit';
import { texts } from '$lib/texts';
import { pbUrl } from '$lib/publicEnv';
import type { User } from '$lib/types/models';
import { addTrustAndNotify, removeTrust, getTrustees } from '$lib/server/trust';
import { generateInviteSlug } from '$lib/inviteSlug';
import { getUserGeolocation, upsertUserGeolocation } from '$lib/server/geolocation';
import { getOwnContact, upsertOwnContact } from '$lib/server/contacts';
import { upsertUserPreferences } from '$lib/server/userPreferences';
import { parseGeolocationFields, parseMessengerContact } from '$lib/server/profileForm';

export async function load({ locals, url }) {
	let inviteCode = locals.user.inviteCode as string | undefined;
	if (!inviteCode) {
		inviteCode = await generateInviteSlug(locals.pb);
		await locals.pb.collection('users').update(locals.user.id, { inviteCode });
	}

	// Exclude deleted (anonymized) accounts from the trustee picker. Project to only the
	// fields the picker uses (id + username), so private base-`users` fields (contactEmail,
	// login email, inviteCode, …) are never serialized to the client (#438 hardening).
	const users = await locals.pb.collection('users').getFullList<User>({
		filter: locals.pb.filter('deleted != true'),
		fields: 'id,username',
	});
	const geolocation = await getUserGeolocation(locals.pb, locals.user.id);
	const contact = await getOwnContact(locals.pb, locals.user.id);
	const trustIds = (await getTrustees(locals.pb, locals.user.id)).map((t) => t.trustee);

	return {
		PB_URL: pbUrl(),
		inviteUrl: `${url.origin}/invite/${inviteCode}`,
		username: locals.user.username as string,
		users,
		trustIds,
		geolocation,
		contact,
	};
}

/** Shared fallback for onboarding actions with no more specific error mapping. */
const genericFailure = () => fail(500, { error: true, message: texts.errors.somethingWentWrong });

export const actions = {
	saveLocation: async ({ locals, request }) => {
		const formData = await request.formData();

		const updateData: Record<string, any> = {};

		const city = formData.get('city')?.toString();
		if (city !== undefined) {
			updateData['city'] = city.trim();
		}

		const geo = parseGeolocationFields(formData, city);

		try {
			await locals.pb.collection('users').update(locals.user.id, updateData);
			if (geo !== undefined) await upsertUserGeolocation(locals.pb, locals.user.id, geo);
			return { success: true };
		} catch {
			return genericFailure();
		}
	},

	addTrustee: async ({ locals, request }) => {
		const formData = await request.formData();
		const newTrusteeId = formData.get('trusteeId') as string;

		const result = await addTrustAndNotify(locals.pb, locals.user, newTrusteeId);
		if (!result.ok) return fail(result.status, { error: true, message: result.message });
	},

	saveProfile: async ({ locals, request }) => {
		const formData = await request.formData();
		const pbFormData = new FormData();

		const bio = formData.get('bio')?.toString();
		if (bio !== undefined) pbFormData.append('bio', bio.trim());

		const profileImageFile = formData.get('profileImage');
		if (profileImageFile instanceof File && profileImageFile.size > 0) {
			pbFormData.append('profileImage', profileImageFile);
		}

		try {
			await locals.pb.collection('users').update(locals.user.id, pbFormData);
			return { success: true };
		} catch {
			return genericFailure();
		}
	},

	saveTransportMode: async ({ locals, request }) => {
		const formData = await request.formData();
		const mode = formData.get('mode')?.toString();
		if (mode === 'foot' || mode === 'bicycle' || mode === 'car') {
			try {
				await upsertUserPreferences(locals.pb, locals.user.id, { preferredTransportMode: mode });
			} catch {
				// non-critical — proceed regardless
			}
		}
		return { success: true };
	},

	removeTrustee: async ({ locals, request }) => {
		const formData = await request.formData();
		const toRemoveTrusteeId = formData.get('trusteeId') as string;
		try {
			await removeTrust(locals.pb, locals.user.id, toRemoveTrusteeId);
		} catch (error: Error | any) {
			console.error(error?.message ?? error);
			return genericFailure();
		}
	},

	complete: async ({ locals, request }) => {
		const formData = await request.formData();

		// Same messenger fields (and validation) as the profile settings form.
		const parsed = parseMessengerContact(formData);
		if (!parsed.ok) return fail(400, { error: true, message: parsed.message });

		try {
			await upsertUserPreferences(locals.pb, locals.user.id, { hasOnboarded: true });
			await upsertOwnContact(locals.pb, locals.user.id, parsed.value);
			return { success: true };
		} catch {
			return genericFailure();
		}
	},
};
