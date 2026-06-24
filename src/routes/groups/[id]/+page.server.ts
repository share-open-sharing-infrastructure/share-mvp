import { fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import type { Group } from '$lib/types/models';

type GroupState = 'valid' | 'invalid';

export async function load({ locals, params }) {
	// The collection viewRule exposes a group to its owner, its members, and — for
	// public groups — any authenticated user. A private group the viewer isn't part
	// of simply 404s here, which we render as "invalid".
	let group: Group;
	try {
		group = await locals.pb.collection('groups').getOne<Group>(params.id);
	} catch {
		return { state: 'invalid' as GroupState, group: null };
	}

	const isOwner = group.owner === locals.user.id;
	let isMember = false;
	try {
		await locals.pb
			.collection('group_members')
			.getFirstListItem(
				locals.pb.filter('group = {:g} && user = {:u}', { g: group.id, u: locals.user.id })
			);
		isMember = true;
	} catch {
		isMember = false;
	}

	// Owner or existing member: nothing to join — send them to the group page.
	if (isOwner || isMember) {
		redirect(303, `/user/groups/${group.id}`);
	}

	return {
		state: 'valid' as GroupState,
		group: { id: group.id, name: group.name, description: group.description ?? '', isPublic: !!group.isPublic },
	};
}

export const actions = {
	join: async ({ locals, params }) => {
		try {
			// Self-join: the backend createRule only permits this for public groups
			// and only for the requester themselves.
			await locals.pb
				.collection('group_members')
				.create({ group: params.id, user: locals.user.id, role: 'member' });
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			// Already a member? Treat as idempotent success.
			try {
				await locals.pb
					.collection('group_members')
					.getFirstListItem(
						locals.pb.filter('group = {:g} && user = {:u}', { g: params.id, u: locals.user.id })
					);
				return { joined: true, alreadyMember: true };
			} catch {
				return fail(e.status ?? 500, { fail: true, message: texts.groups.invalidInvite });
			}
		}
		return { joined: true, alreadyMember: false };
	},
};
