import { error, redirect } from '@sveltejs/kit';
import type PocketBase from 'pocketbase';
import type { Group, GroupMember, UserId } from '$lib/types/models';

/**
 * A group plus the count of its members and the viewer's relationship to it.
 */
export interface GroupSummary {
	id: string;
	name: string;
	description?: string;
	owner: UserId;
	memberCount: number;
	isOwner: boolean;
	isPublic: boolean;
}

/**
 * Raw groups a user owns and is a member of (no member counts). Shared by the
 * count-bearing summary loader and the lightweight attachable-groups list.
 */
async function loadOwnedAndMember(
	pb: PocketBase,
	userId: UserId
): Promise<{ ownedGroups: Group[]; memberGroups: Group[] }> {
	const [ownedGroups, memberships] = await Promise.all([
		pb
			.collection('groups')
			.getFullList<Group>({ filter: pb.filter('owner = {:uid}', { uid: userId }), sort: 'name' }),
		pb
			.collection('group_members')
			.getFullList<GroupMember>({ filter: pb.filter('user = {:uid}', { uid: userId }), expand: 'group' }),
	]);

	// The owner is now stored as an `admin` group_members row too, so the
	// membership query also returns groups the user owns. Keep those out of the
	// "member" bucket (they belong in "owned") by filtering on the group owner.
	const memberGroups = memberships
		.map((m) => m.expand?.group as Group | undefined)
		.filter((g): g is Group => !!g && g.owner !== userId);

	return { ownedGroups, memberGroups };
}

/**
 * Load the groups a user owns and the groups they are a member of, each with a
 * member count. The owner is stored as an `admin` group_members row, so the
 * member count includes the owner (no +1 needed).
 */
export async function getUserGroups(
	pb: PocketBase,
	userId: UserId
): Promise<{ owned: GroupSummary[]; member: GroupSummary[] }> {
	const { ownedGroups, memberGroups } = await loadOwnedAndMember(pb, userId);

	// Member counts for ALL groups in a single query. Firing one getList per group
	// in parallel trips PocketBase's auto-cancellation (identical concurrent
	// requests to the same endpoint cancel each other), so we aggregate instead.
	const counts = await countMembersForGroups(pb, [...ownedGroups, ...memberGroups].map((g) => g.id));

	const toSummary = (g: Group, isOwner: boolean): GroupSummary => ({
		id: g.id,
		name: g.name,
		description: g.description,
		owner: g.owner,
		isOwner,
		isPublic: !!g.isPublic,
		memberCount: counts.get(g.id) ?? 0,
	});

	return {
		owned: ownedGroups.map((g) => toSummary(g, true)),
		member: memberGroups.map((g) => toSummary(g, false)),
	};
}

/**
 * Flat, deduplicated list of groups the user may attach to their items
 * (groups they own or are a member of), for the item form's group picker.
 * Skips member counts — they aren't needed here.
 */
export async function getAttachableGroups(
	pb: PocketBase,
	userId: UserId
): Promise<{ id: string; name: string; isPublic: boolean }[]> {
	const { ownedGroups, memberGroups } = await loadOwnedAndMember(pb, userId);
	const byId = new Map<string, { id: string; name: string; isPublic: boolean }>();
	for (const g of [...ownedGroups, ...memberGroups])
		byId.set(g.id, { id: g.id, name: g.name, isPublic: !!g.isPublic });
	return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Member counts for several groups in a single query, returned as a Map
 * groupId -> count (0 for groups with no members). Avoids the N+1 — and the
 * PocketBase auto-cancellation that parallel identical getList calls trigger.
 */
export async function countMembersForGroups(
	pb: PocketBase,
	groupIds: string[]
): Promise<Map<string, number>> {
	const counts = new Map<string, number>(groupIds.map((id) => [id, 0]));
	if (groupIds.length === 0) return counts;

	const filter = groupIds.map((_, i) => `group = {:g${i}}`).join(' || ');
	const params = Object.fromEntries(groupIds.map((id, i) => [`g${i}`, id]));
	const rows = await pb
		.collection('group_members')
		.getFullList<{ group: string }>({ filter: pb.filter(filter, params), fields: 'group' });

	for (const r of rows) counts.set(r.group, (counts.get(r.group) ?? 0) + 1);
	return counts;
}

/**
 * Fetch a group and enforce that the user may view it (owner or member). Throws 404 if the
 * group does not exist and redirects to the group list if the user is neither the owner nor
 * a member. Shared by the group overview and its sub-pages (`/members`, `/settings`)
 * so the guard lives in one place.
 *
 * Returns the group, whether the user owns it, and the (expanded) membership rows — the
 * members sub-page reuses `memberRows`; the others just need the guard + `isOwner`.
 */
export async function requireGroupMembership(pb: PocketBase, userId: UserId, groupId: string) {
	let group: Group;
	try {
		group = await pb.collection('groups').getOne<Group>(groupId);
	} catch {
		error(404, 'Group not found');
	}

	const isOwner = group.owner === userId;

	const memberRows = await pb.collection('group_members').getFullList<GroupMember>({
		filter: pb.filter('group = {:gid}', { gid: groupId }),
		expand: 'user',
		sort: 'created',
	});

	if (!isOwner && !memberRows.some((m) => m.user === userId)) {
		redirect(303, '/user/groups');
	}

	return { group, isOwner, memberRows };
}

/**
 * Lightweight ownership check for form actions (defense-in-depth). The backend collection
 * rules already reject a non-owner mutation, but asserting ownership in the action lets us
 * return a clean 403 with a friendly message instead of a generic backend failure. Returns
 * false if the group is missing or the user is not its owner.
 */
export async function isGroupOwner(pb: PocketBase, userId: UserId, groupId: string): Promise<boolean> {
	try {
		const group = await pb.collection('groups').getOne<Group>(groupId, { fields: 'id,owner' });
		return group.owner === userId;
	} catch {
		return false;
	}
}
