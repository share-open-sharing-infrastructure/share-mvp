/* eslint-disable @typescript-eslint/no-explicit-any */
import { fail } from '@sveltejs/kit';
import { texts } from '$lib/texts';
import { PUBLIC_PB_URL } from '../../hooks.server';
import type { User } from '$lib/types/models';
import { createNotification, sendPushToUser } from '$lib/server/notifications';

export async function load({ locals, url }) {
	let inviteCode = locals.user.inviteCode as string | undefined;
	if (!inviteCode) {
		inviteCode = crypto.randomUUID();
		await locals.pb.collection('users').update(locals.user.id, { inviteCode });
	}

	const users = await locals.pb.collection('users').getFullList<User>();

	return {
		PB_URL: PUBLIC_PB_URL,
		inviteUrl: `${url.origin}/auth/register?invite=${inviteCode}`,
		users,
		trustIds: (locals.user.trusts as string[]) ?? [],
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

		const geoLon = formData.get('geolocation_lon')?.toString();
		const geoLat = formData.get('geolocation_lat')?.toString();
		if (geoLon && geoLat) {
			const lon = parseFloat(geoLon);
			const lat = parseFloat(geoLat);
			if (!isNaN(lon) && !isNaN(lat)) {
				updateData['geolocation'] = { lon, lat };
			}
		} else if (city === '') {
			updateData['geolocation'] = null;
		}

		try {
			await locals.pb.collection('users').update(locals.user.id, updateData);
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

	complete: async ({ locals, request }) => {
		const formData = await request.formData();

		const updateData: Record<string, any> = { hasOnboarded: true };

		const telegramUsername = formData.get('telegramUsername')?.toString();
		if (telegramUsername !== undefined) {
			const trimmed = telegramUsername.trim();
			if (trimmed !== '') {
				const cleaned = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
				if (!/^[a-zA-Z0-9_]{5,32}$/.test(cleaned)) {
					return fail(400, { error: true, message: texts.errors.invalidTelegramUsername });
				}
				updateData['telegramUsername'] = cleaned;
			}
		}

		updateData['telegramVisibleToTrustedOnly'] =
			formData.get('telegramVisibleToTrustedOnly') === 'on';

		const signalLink = formData.get('signalLink')?.toString();
		if (signalLink !== undefined) {
			const trimmed = signalLink.trim();
			if (trimmed !== '') {
				if (!trimmed.includes('signal.me')) {
					return fail(400, { error: true, message: texts.errors.invalidSignalLink });
				}
				updateData['signalLink'] = trimmed;
			}
		}

		updateData['signalVisibleToTrustedOnly'] =
			formData.get('signalVisibleToTrustedOnly') === 'on';

		try {
			await locals.pb.collection('users').update(locals.user.id, updateData);
			return { success: true };
		} catch {
			return fail(500, { error: true, message: texts.errors.somethingWentWrong });
		}
	},
};
