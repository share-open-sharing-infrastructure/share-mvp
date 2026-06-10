import type { User } from '$lib/types/models';

export async function load({ locals, params }) {
	const { slug } = params;

	try {
		const inviter = await locals.pb
			.collection('users_public')
			.getFirstListItem<User>(locals.pb.filter('inviteCode = {:code}', { code: slug }));
		return { inviterName: inviter.username, slug };
	} catch {
		return { inviterName: null, slug };
	}
}
