import { fail } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import { requireGroupMembership, isGroupOwner } from '$lib/server/groups';
import { displayName } from '$lib/utils/utils';

// Lending states in which the borrower currently holds (or is arranging to hold)
// one of the owner's items — used to warn before removing such a member.
const ACTIVE_LENDING_STATES = ['accepted', 'active', 'return_requested'];

export async function load({ locals, params }) {
	const { group, isOwner, memberRows } = await requireGroupMembership(
		locals.pb,
		locals.user!.id,
		params.id
	);

	// Conversations where a member currently borrows one of my items (owner only —
	// drives the "active lending" warning before removal).
	const activeBorrowerIds = new Set<string>();
	if (isOwner) {
		try {
			const convs = await locals.pb
				.collection('conversations')
				.getFullList<{ requester: string; lendingStatus?: string }>({
					filter: locals.pb.filter('itemOwner = {:me}', { me: locals.user!.id }),
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
	}

	const members = memberRows
		.map((m) => {
			const u = m.expand?.user as { id: string; username: string; deleted?: boolean } | undefined;
			return {
				membershipId: m.id,
				userId: m.user,
				// A deleted account keeps its group_members row (the deletion hook anonymizes
				// the users row in place), so mask it as "Gelöschtes Konto" instead of leaking
				// the placeholder username.
				username: u ? displayName(u) : m.user,
				role: (m.role ?? 'member') as 'admin' | 'member',
				isOwner: m.user === group.owner,
				hasActiveLending: activeBorrowerIds.has(m.user),
			};
		})
		// Admins (incl. the owner) first, then by name.
		.sort((a, b) => {
			if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
			return a.username.localeCompare(b.username);
		});

	// Candidate users for the owner's add-member search (everyone not already in).
	let candidateUsers: { id: string; username: string }[] = [];
	if (isOwner) {
		const memberIds = new Set(memberRows.map((m) => m.user));
		try {
			const all = await locals.pb
				.collection('users')
				.getFullList<{ id: string; username: string; deleted?: boolean }>({
					fields: 'id,username,deleted',
					sort: 'username',
				});
			// Exclude existing members and deleted accounts (a deleted account must not be
			// re-addable, and its placeholder username must not surface in the picker).
			candidateUsers = all
				.filter((u) => !memberIds.has(u.id) && !u.deleted)
				.map((u) => ({ id: u.id, username: u.username }));
		} catch (err) {
			console.error('Failed to load candidate users for add-member search', err);
		}
	}

	return {
		group: { id: group.id, name: group.name },
		isOwner,
		currentUserId: locals.user!.id,
		members,
		candidateUsers,
	};
}

export const actions = {
	addMember: async ({ locals, params, request }) => {
		// Managing members is owner-only; assert it here too (defense-in-depth on top of
		// the backend collection rule) for a clean 403 instead of a generic failure.
		if (!(await isGroupOwner(locals.pb, locals.user!.id, params.id)))
			return fail(403, { fail: true, message: texts.errors.noPermission });

		const formData = await request.formData();
		// The add-member search posts a resolved userId; fall back to an exact
		// username lookup for non-JS / direct submissions.
		const userId = formData.get('userId')?.toString().trim();
		const username = formData.get('username')?.toString().trim();
		if (!userId && !username) return fail(400, { fail: true, message: texts.groups.usernameRequired });

		let user: { id: string };
		try {
			user = userId
				? await locals.pb.collection('users').getOne(userId, { fields: 'id' })
				: await locals.pb
						.collection('users')
						.getFirstListItem(locals.pb.filter('username = {:u}', { u: username }), { fields: 'id' });
		} catch {
			return fail(404, { fail: true, message: texts.errors.userNotFound });
		}

		if (user.id === locals.user!.id) {
			return fail(400, { fail: true, message: texts.groups.cannotAddSelf });
		}

		try {
			await locals.pb
				.collection('group_members')
				.create({ group: params.id, user: user.id, role: 'member' });
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
		if (!(await isGroupOwner(locals.pb, locals.user!.id, params.id)))
			return fail(403, { fail: true, message: texts.errors.noPermission });

		const membershipId = (await request.formData()).get('membershipId')?.toString();
		if (!membershipId) return fail(400, { fail: true, message: texts.errors.missingId });

		try {
			// Ensure the membership really belongs to this (owned) group before deleting.
			const m = await locals.pb.collection('group_members').getOne<{ group: string; role?: string }>(membershipId);
			if (m.group !== params.id) return fail(403, { fail: true, message: texts.errors.noPermission });
			// The owner's own admin membership cannot be removed (would orphan the
			// group) — they must delete the whole group instead. The backend rule
			// enforces this too; surface a friendly message here.
			if (m.role === 'admin') return fail(400, { fail: true, message: texts.groups.cannotRemoveAdmin });
			await locals.pb.collection('group_members').delete(membershipId);
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
		}
		return { success: true };
	},
};
