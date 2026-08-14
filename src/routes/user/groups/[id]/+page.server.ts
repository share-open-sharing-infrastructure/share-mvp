import { pbUrl } from '$lib/publicEnv';
import { requireGroupMembership } from '$lib/server/groups';
import type { ItemPublic } from '$lib/types/models';

export async function load({ locals, params }) {
	const { group, isOwner } = await requireGroupMembership(locals.pb, locals.user!.id, params.id);

	// Items shared with this group. Read the audience-filtered `items_searchable` view: its
	// row-level rule already restricts rows to what the viewer may see, and a group member is
	// always in the audience of the group's items — so this returns exactly the group's shared
	// inventory. The `fields` allowlist mirrors /search and deliberately omits the `groups`
	// column (the view only carries it so its rule can traverse membership; returning it would
	// disclose which other groups an item is shared with).
	let items: ItemPublic[] = [];
	try {
		items = await locals.pb.collection('items_searchable').getFullList<ItemPublic>({
			filter: locals.pb.filter('groups ~ {:gid}', { gid: params.id }),
			sort: '-created',
			fields:
				'id,name,image,externalImgUrl,externalUrl,description,trusteesOnly,status,collectionId,categories,updated,userId,username,isInstitution,bio,verified,profileImage,userCreated,ownerHasLocation',
		});
	} catch (err) {
		console.error('Failed to load group items', err);
	}

	return {
		group: {
			id: group.id,
			name: group.name,
			description: group.description ?? '',
			isPublic: !!group.isPublic,
		},
		isOwner,
		items,
		PB_IMG_URL: pbUrl(),
	};
}
