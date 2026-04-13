import { fail } from '@sveltejs/kit';
import { texts } from '$lib/texts';
import { PUBLIC_PB_URL } from '../../hooks.server';

export async function load({ locals, url }) {

	let inviteCode = locals.user.inviteCode as string | undefined;
	if (!inviteCode) {
		inviteCode = crypto.randomUUID();
		await locals.pb.collection('users').update(locals.user.id, { inviteCode });
	}

	return {
		PB_URL: PUBLIC_PB_URL,
		inviteUrl: `${url.origin}/auth/register?invite=${inviteCode}`,
	};
}

export const actions = {
	saveLocation: async ({ locals, request }) => {
		const formData = await request.formData();

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

	complete: async ({ locals, request }) => {
		const formData = await request.formData();

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
