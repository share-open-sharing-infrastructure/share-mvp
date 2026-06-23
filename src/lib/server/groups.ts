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

	const memberGroups = memberships
		.map((m) => m.expand?.group as Group | undefined)
		.filter((g): g is Group => !!g);

	return { ownedGroups, memberGroups };
}

/**
 * Load the groups a user owns and the groups they are a member of, each with a
 * member count. Member counts exclude the owner (members live in group_members).
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
): Promise<{ id: string; name: string }[]> {
	const { ownedGroups, memberGroups } = await loadOwnedAndMember(pb, userId);
	const byId = new Map<string, { id: string; name: string }>();
	for (const g of [...ownedGroups, ...memberGroups]) byId.set(g.id, { id: g.id, name: g.name });
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
