import { fail } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import { getUserGroups } from '$lib/server/groups';

export async function load({ locals }) {
	const { owned, member } = await getUserGroups(locals.pb, locals.user.id);
	return { owned, member };
}

export const actions = {
	create: async ({ locals, request }) => {
		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const description = formData.get('description')?.toString().trim() ?? '';

		if (!name) {
			return fail(400, { fail: true, message: texts.groups.nameRequired });
		}

		try {
			await locals.pb.collection('groups').create({
				name,
				description,
				owner: locals.user.id,
			});
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
		}

		return { success: true };
	},

	leave: async ({ locals, request }) => {
		const groupId = (await request.formData()).get('groupId')?.toString();
		if (!groupId) return fail(400, { fail: true, message: texts.errors.missingId });

		try {
			const membership = await locals.pb
				.collection('group_members')
				.getFirstListItem(
					locals.pb.filter('group = {:gid} && user = {:uid}', {
						gid: groupId,
						uid: locals.user.id,
					})
				);
			await locals.pb.collection('group_members').delete(membership.id);
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
		}

		return { success: true };
	},
};
