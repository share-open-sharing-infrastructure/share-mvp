import type PocketBase from 'pocketbase';

export type UserContact = {
	telegramUsername: string;
	signalLink: string;
	telegramVisibleToTrustedOnly: boolean;
	signalVisibleToTrustedOnly: boolean;
};

export type ResolvedContact = {
	telegramUsername: string | null;
	telegramHidden: boolean;
	signalLink: string | null;
	signalHidden: boolean;
};

/** The current user's own contact row (for prefilling their own profile/onboarding forms). */
export async function getOwnContact(pb: PocketBase, userId: string): Promise<Partial<UserContact>> {
	try {
		const rec = await pb
			.collection('user_contacts')
			.getFirstListItem(pb.filter('user = {:u}', { u: userId }));
		return {
			telegramUsername: (rec.telegramUsername as string) ?? '',
			signalLink: (rec.signalLink as string) ?? '',
			telegramVisibleToTrustedOnly: (rec.telegramVisibleToTrustedOnly as boolean) ?? true,
			signalVisibleToTrustedOnly: (rec.signalVisibleToTrustedOnly as boolean) ?? true,
		};
	} catch {
		return {};
	}
}

/** Upserts the current user's own contact row. */
export async function upsertOwnContact(pb: PocketBase, userId: string, contact: UserContact): Promise<void> {
	let existingId: string | null = null;
	try {
		const rec = await pb
			.collection('user_contacts')
			.getFirstListItem(pb.filter('user = {:u}', { u: userId }));
		existingId = rec.id;
	} catch {
		// no existing row
	}
	const data = { user: userId, ...contact };
	if (existingId) await pb.collection('user_contacts').update(existingId, data);
	else await pb.collection('user_contacts').create(data);
}

/** Resolves another user's visible contact handles via the privileged `/api/contact` hook. */
export async function fetchPartnerContact(pb: PocketBase, userId: string): Promise<ResolvedContact> {
	try {
		return await pb.send<ResolvedContact>(`/api/contact/${encodeURIComponent(userId)}`, { method: 'GET' });
	} catch {
		return { telegramUsername: null, telegramHidden: false, signalLink: null, signalHidden: false };
	}
}
