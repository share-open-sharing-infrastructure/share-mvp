import { fail, redirect, error } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import type { Group, GroupMember, GroupInvite } from '$lib/types/models';

// Lending states in which the borrower currently holds (or is arranging to hold)
// one of the owner's items — used to warn before removing such a member.
const ACTIVE_LENDING_STATES = ['accepted', 'active', 'return_requested'];

export async function load({ locals, params, url }) {
	let group: Group;
	try {
		group = await locals.pb.collection('groups').getOne<Group>(params.id);
	} catch {
		error(404, 'Group not found');
	}

	// Only the owner manages a group. Members land back on the overview.
	if (group.owner !== locals.user.id) {
		redirect(303, '/user/groups');
	}

	const memberRows = await locals.pb.collection('group_members').getFullList<GroupMember>({
		filter: locals.pb.filter('group = {:gid}', { gid: params.id }),
		expand: 'user',
		sort: 'created',
	});

	// Conversations where a member currently borrows one of my items.
	const activeBorrowerIds = new Set<string>();
	try {
		const convs = await locals.pb
			.collection('conversations')
			.getFullList<{ requester: string; lendingStatus?: string }>({
				filter: locals.pb.filter('itemOwner = {:me}', { me: locals.user.id }),
				fields: 'requester,lendingStatus',
			});
		for (const c of convs) {
			if (ACTIVE_LENDING_STATES.includes(c.lendingStatus ?? '')) {
				activeBorrowerIds.add(c.requester);
			}
		}
	} catch (err) {
		console.error('Failed to load lending state for group members', err);
	}

	const members = memberRows.map((m) => {
		const u = m.expand?.user as { id: string; username: string } | undefined;
		return {
			membershipId: m.id,
			userId: m.user,
			username: u?.username ?? m.user,
			hasActiveLending: activeBorrowerIds.has(m.user),
		};
	});

	// Most recent invite for this group (we keep a single active link in the UI).
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
		group: { id: group.id, name: group.name, description: group.description ?? '' },
		members,
		invite,
	};
}

export const actions = {
	updateGroup: async ({ locals, params, request }) => {
		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const description = formData.get('description')?.toString().trim() ?? '';
		if (!name) return fail(400, { fail: true, message: texts.groups.nameRequired });

		try {
			await locals.pb.collection('groups').update(params.id, { name, description });
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
		}
		return { success: true };
	},

	addMember: async ({ locals, params, request }) => {
		const username = (await request.formData()).get('username')?.toString().trim();
		if (!username) return fail(400, { fail: true, message: texts.groups.usernameRequired });

		let user: { id: string };
		try {
			user = await locals.pb
				.collection('users')
				.getFirstListItem(locals.pb.filter('username = {:u}', { u: username }), { fields: 'id' });
		} catch {
			return fail(404, { fail: true, message: texts.errors.userNotFound });
		}

		if (user.id === locals.user.id) {
			return fail(400, { fail: true, message: texts.groups.cannotAddSelf });
		}

		try {
			await locals.pb.collection('group_members').create({ group: params.id, user: user.id });
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			// A 400 is most likely the unique (group,user) index firing because the
			// user is already a member. Confirm that's actually the case rather than
			// swallowing every 400 (which would hide genuine create failures).
			try {
				await locals.pb
					.collection('group_members')
					.getFirstListItem(
						locals.pb.filter('group = {:g} && user = {:u}', { g: params.id, u: user.id })
					);
				// Already a member -> idempotent success.
			} catch {
				return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
			}
		}
		return { success: true };
	},

	removeMember: async ({ locals, params, request }) => {
		const membershipId = (await request.formData()).get('membershipId')?.toString();
		if (!membershipId) return fail(400, { fail: true, message: texts.errors.missingId });

		try {
			// Ensure the membership really belongs to this (owned) group before deleting.
			const m = await locals.pb.collection('group_members').getOne<GroupMember>(membershipId);
			if (m.group !== params.id) return fail(403, { fail: true, message: texts.errors.noPermission });
			await locals.pb.collection('group_members').delete(membershipId);
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
		}
		return { success: true };
	},

	createInvite: async ({ locals, params, request }) => {
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
				createdBy: locals.user.id,
				uses: 0,
				maxUses,
				...(expiresAt ? { expiresAt } : {}),
			});
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
		}
		return { success: true };
	},

	revokeInvite: async ({ locals, request }) => {
		const inviteId = (await request.formData()).get('inviteId')?.toString();
		if (!inviteId) return fail(400, { fail: true, message: texts.errors.missingId });
		try {
			await locals.pb.collection('group_invites').delete(inviteId);
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
		}
		return { success: true };
	},

	deleteGroup: async ({ locals, params }) => {
		try {
			await locals.pb.collection('groups').delete(params.id);
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
		}
		redirect(303, '/user/groups');
	},
};
