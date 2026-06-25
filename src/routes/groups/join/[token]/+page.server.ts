import { fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';

type InviteState = 'valid' | 'invalid' | 'expired';

export async function load({ locals, params }) {
	// Preview the invite via the backend hook (operates in elevated context so it
	// can read invites that API rules keep private).
	const loggedIn = !!locals.user;
	try {
		const res = await locals.pb.send(`/api/group-invite/${params.token}`, { method: 'GET' });
		return {
			state: 'valid' as InviteState,
			groupName: res?.group?.name ?? '',
			token: params.token,
			loggedIn,
		};
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		return {
			state: (e.status === 410 ? 'expired' : 'invalid') as InviteState,
			groupName: '',
			token: params.token,
			loggedIn,
		};
	}
}

export const actions = {
	join: async ({ locals, params }) => {
		// The route is public so the preview shows before login, but joining needs
		// an account — bounce guests to login and bring them back here afterwards.
		if (!locals.user) {
			redirect(303, `/auth/login?redirectTo=${encodeURIComponent('/groups/join/' + params.token)}`);
		}
		try {
			const res = await locals.pb.send(`/api/group-invite/${params.token}/join`, { method: 'POST' });
			// Stay on the page and report the outcome (joined vs. already a member)
			// instead of silently redirecting, so the user gets clear feedback.
			return {
				joined: true,
				alreadyMember: !!res?.alreadyMember,
				groupName: res?.group?.name ?? '',
			};
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, {
				fail: true,
				message: e.status === 410 ? texts.groups.expiredInvite : texts.groups.invalidInvite,
			});
		}
	},
};
