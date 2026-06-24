/* eslint-disable @typescript-eslint/no-explicit-any */
import { fail } from '@sveltejs/kit';
import { texts } from '$lib/texts';
import { PUBLIC_PB_URL } from '../../hooks.server';
import type { User } from '$lib/types/models';
import { createNotification, sendPushToUser } from '$lib/server/notifications';
import { generateInviteSlug } from '$lib/inviteSlug';
import { getUserGeolocation, upsertUserGeolocation } from '$lib/server/geolocation';
import { getOwnContact, upsertOwnContact } from '$lib/server/contacts';

export async function load({ locals, url }) {
	let inviteCode = locals.user.inviteCode as string | undefined;
	if (!inviteCode) {
		inviteCode = await generateInviteSlug(locals.pb);
		await locals.pb.collection('users').update(locals.user.id, { inviteCode });
	}

	// Exclude deleted (anonymized) accounts from the trustee picker.
	const users = await locals.pb.collection('users').getFullList<User>({
		filter: locals.pb.filter('deleted != true'),
	});
	const geolocation = await getUserGeolocation(locals.pb, locals.user.id);
	const contact = await getOwnContact(locals.pb, locals.user.id);

	return {
		PB_URL: PUBLIC_PB_URL,
		inviteUrl: `${url.origin}/invite/${inviteCode}`,
		username: locals.user.username as string,
		users,
		trustIds: (locals.user.trusts as string[]) ?? [],
		geolocation,
		contact,
	};
}

export const actions = {
	saveLocation: async ({ locals, request }) => {
		const formData = await request.formData();

		const updateData: Record<string, any> = {};

		const city = formData.get('city')?.toString();
		if (city !== undefined) {
			updateData['city'] = city.trim();
		}

		let geo: { lon: number; lat: number } | null | undefined;
		const geoLon = formData.get('geolocation_lon')?.toString();
		const geoLat = formData.get('geolocation_lat')?.toString();
		if (geoLon && geoLat) {
			const lon = parseFloat(geoLon);
			const lat = parseFloat(geoLat);
			if (!isNaN(lon) && !isNaN(lat)) {
				geo = { lon, lat };
			}
		} else if (city === '') {
			geo = null;
		}

		try {
			await locals.pb.collection('users').update(locals.user.id, updateData);
			if (geo !== undefined) await upsertUserGeolocation(locals.pb, locals.user.id, geo);
			return { success: true };
		} catch {
			return fail(500, { error: true, message: texts.errors.somethingWentWrong });
		}
	},

	addTrustee: async ({ locals, request }) => {
		const formData = await request.formData();
		const newTrusteeId = formData.get('trusteeId');

		try {
			await locals.pb.collection('users').update(locals.user.id, {
				trusts: [...(locals.user.trusts || []), newTrusteeId],
			});
		} catch (error: Error | any) {
			console.error(error?.message ?? error);
		}

		const adderName = locals.user.username ?? 'Jemand';
		const notificationBody = texts.notifications.trustAdded(adderName);
		await createNotification(locals.pb, newTrusteeId as string, locals.user.id, 'trust_added', locals.user.id, notificationBody);
		await sendPushToUser(locals.pb, newTrusteeId as string, texts.notifications.pushTitle, notificationBody, `/users/${locals.user.id}`);
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
			return fail(500, { error: true, message: texts.errors.somethingWentWrong });
		}
	},

	saveTransportMode: async ({ locals, request }) => {
		const formData = await request.formData();
		const mode = formData.get('mode')?.toString();
		if (mode === 'foot' || mode === 'bicycle' || mode === 'car') {
			try {
				await locals.pb.collection('users').update(locals.user.id, { preferredTransportMode: mode });
			} catch {
				// non-critical — proceed regardless
			}
		}
		return { success: true };
	},

	removeTrustee: async ({ locals, request }) => {
		const formData = await request.formData();
		const toRemoveTrusteeId = formData.get('trusteeId');
		try {
			const updatedTrusts = (locals.user.trusts || []).filter(
				(id: string) => id !== toRemoveTrusteeId
			);
			await locals.pb.collection('users').update(locals.user.id, { trusts: updatedTrusts });
		} catch (error: Error | any) {
			console.error(error?.message ?? error);
		}
	},

	complete: async ({ locals, request }) => {
		const formData = await request.formData();

		const contact = {
			telegramUsername: '',
			signalLink: '',
			telegramVisibleToTrustedOnly: formData.get('telegramVisibleToTrustedOnly') === 'on',
			signalVisibleToTrustedOnly: formData.get('signalVisibleToTrustedOnly') === 'on',
		};

		const telegramUsername = formData.get('telegramUsername')?.toString();
		if (telegramUsername !== undefined) {
			const trimmed = telegramUsername.trim();
			if (trimmed !== '') {
				const cleaned = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
				if (!/^[a-zA-Z0-9_]{5,32}$/.test(cleaned)) {
					return fail(400, { error: true, message: texts.errors.invalidTelegramUsername });
				}
				contact.telegramUsername = cleaned;
			}
		}

		const signalLink = formData.get('signalLink')?.toString();
		if (signalLink !== undefined) {
			const trimmed = signalLink.trim();
			if (trimmed !== '') {
				if (!trimmed.includes('signal.me')) {
					return fail(400, { error: true, message: texts.errors.invalidSignalLink });
				}
				contact.signalLink = trimmed;
			}
		}

		try {
			await locals.pb.collection('users').update(locals.user.id, { hasOnboarded: true });
			await upsertOwnContact(locals.pb, locals.user.id, contact);
			return { success: true };
		} catch {
			return fail(500, { error: true, message: texts.errors.somethingWentWrong });
		}
	},
};
