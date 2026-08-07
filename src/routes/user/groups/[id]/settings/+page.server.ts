import { fail, redirect } from '@sveltejs/kit';
import { texts } from '$lib/texts';
import { failFromPbError } from '$lib/server/pbErrors';
import { requireGroupMembership, isGroupOwner } from '$lib/server/groups';
import type { GroupInvite } from '$lib/types/models';

// Every settings mutation is owner-only. Asserting ownership in the action (on top of the
// backend collection rule) yields a clean 403 instead of a generic backend failure.
async function assertOwner(locals: App.Locals, groupId: string) {
	return isGroupOwner(locals.pb, locals.user!.id, groupId);
}

export async function load({ locals, params, url }) {
	const { group, isOwner } = await requireGroupMembership(locals.pb, locals.user!.id, params.id);
	// Settings are owner-only; send members back to the group overview.
	if (!isOwner) redirect(303, `/user/groups/${params.id}`);

	// Most recent invite for this group (single active link in the UI).
	let invite: { id: string; token: string; url: string; uses: number; maxUses: number; expiresAt: string } | null =
		null;
	try {
		const inv = await locals.pb.collection('group_invites').getFirstListItem<GroupInvite>(
			locals.pb.filter('group = {:gid}', { gid: params.id }),
			{ sort: '-created' }
		);
		invite = {
			id: inv.id,
			token: inv.token,
			url: `${url.origin}/groups/join/${inv.token}`,
			uses: inv.uses ?? 0,
			maxUses: inv.maxUses ?? 0,
			expiresAt: inv.expiresAt ?? '',
		};
	} catch {
		invite = null;
	}

	return {
		group: {
			id: group.id,
			name: group.name,
			description: group.description ?? '',
			isPublic: !!group.isPublic,
		},
		invite,
		publicUrl: `${url.origin}/groups/${group.id}`,
	};
}

export const actions = {
	updateGroup: async ({ locals, params, request }) => {
		if (!(await assertOwner(locals, params.id)))
			return fail(403, { fail: true, message: texts.errors.noPermission });

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const description = formData.get('description')?.toString().trim() ?? '';
		const isPublic = formData.get('isPublic') === 'on' || formData.get('isPublic') === 'true';
		if (!name) return fail(400, { fail: true, message: texts.groups.nameRequired });

		try {
			await locals.pb.collection('groups').update(params.id, { name, description, isPublic });
		} catch (err) {
			return failFromPbError(err);
		}
		return { success: true };
	},

	createInvite: async ({ locals, params, request }) => {
		if (!(await assertOwner(locals, params.id)))
			return fail(403, { fail: true, message: texts.errors.noPermission });

		const formData = await request.formData();
		// <input type="date"> yields YYYY-MM-DD. Treat the chosen day as inclusive
		// (valid through its end) instead of expiring at 00:00 UTC a day early. The
		// format matches the backend's lexicographic compare (nowIso()).
		const expiresDate = formData.get('expiresAt')?.toString().trim();
		const expiresAt = expiresDate ? `${expiresDate} 23:59:59.000Z` : '';
		const maxUsesRaw = formData.get('maxUses')?.toString().trim();
		const maxUses = maxUsesRaw ? Math.max(0, parseInt(maxUsesRaw, 10) || 0) : 0;

		// Single active link per group: drop any existing invites first.
		try {
			const existing = await locals.pb
				.collection('group_invites')
				.getFullList({ filter: locals.pb.filter('group = {:gid}', { gid: params.id }) });
			for (const inv of existing) await locals.pb.collection('group_invites').delete(inv.id);
		} catch (err) {
			console.error('Failed clearing old invites', err);
		}

		try {
			await locals.pb.collection('group_invites').create({
				group: params.id,
				createdBy: locals.user!.id,
				uses: 0,
				maxUses,
				...(expiresAt ? { expiresAt } : {}),
			});
		} catch (err) {
			return failFromPbError(err);
		}
		return { success: true };
	},

	revokeInvite: async ({ locals, params, request }) => {
		if (!(await assertOwner(locals, params.id)))
			return fail(403, { fail: true, message: texts.errors.noPermission });

		const inviteId = (await request.formData()).get('inviteId')?.toString();
		if (!inviteId) return fail(400, { fail: true, message: texts.errors.missingId });
		try {
			await locals.pb.collection('group_invites').delete(inviteId);
		} catch (err) {
			return failFromPbError(err);
		}
		return { success: true };
	},

	deleteGroup: async ({ locals, params }) => {
		if (!(await assertOwner(locals, params.id)))
			return fail(403, { fail: true, message: texts.errors.noPermission });

		try {
			await locals.pb.collection('groups').delete(params.id);
		} catch (err) {
			return failFromPbError(err);
		}
		redirect(303, '/user/groups');
	},
};
