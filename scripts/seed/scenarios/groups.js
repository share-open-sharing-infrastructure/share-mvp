/**
 * Scenario: group detail page — items shared with a group (issue #485).
 *
 * Sets up a login user who is BOTH a plain member of one group and the owner/admin of
 * another, so a single login exercises both variants of the group detail page:
 *
 *   grp_member_seed  — the login user.
 *     • plain member of "Werkzeugkreis Nord" (owned by grp_owner_seed)  → read-only view
 *     • owner/admin of "Nachbarschaft Süd"                             → management view
 *   grp_owner_seed   — owns "Werkzeugkreis Nord", shares items with it.
 *   grp_friend_seed  — member of both groups, shares items with both (so the item cards
 *                      show DIFFERENT owners → verifies the "with owner" card style).
 *
 * "Werkzeugkreis Nord" carries ~16 shared items across many categories and owners (a few
 * unavailable) so the grid, search and category filter have realistic volume; "Nachbarschaft
 * Süd" carries 4. grp_owner_seed also has a NON-shared public item that must NOT appear in any
 * group list (verifies the `groups ~ id` filter).
 *
 * Login for all: password from lib.js ("password123"), email `<username>@seed.test`.
 *
 * The group owner's admin membership is created automatically by the backend
 * group-create hook, so we only add the extra member rows here.
 */
import { createUser, createItem, USER_PASSWORD, SEED_DOMAIN } from '../lib.js';

export const description =
	'Group detail page (#485): a login user who is a member of one group and owner of another, ~20 shared items.';

/** Add a plain member to a group (role defaults to "member" via backend hook). */
function addMember(pb, groupId, userId) {
	return pb.collection('group_members').create({ group: groupId, user: userId });
}

/** Create an item and share it with the given group in one step. */
async function sharedItem(pb, groupId, ownerId, name, category, status) {
	const item = await createItem(pb, ownerId, name, [category], status ? { status } : {});
	await pb.collection('items').update(item.id, { groups: [groupId] });
	return item;
}

export async function run(pb) {
	const member = await createUser(pb, 'grp_member_seed');
	const owner = await createUser(pb, 'grp_owner_seed');
	const friend = await createUser(pb, 'grp_friend_seed');

	// Group 1: owned by grp_owner_seed; grp_member_seed is a plain member (read-only view).
	const nord = await pb.collection('groups').create({
		name: 'Werkzeugkreis Nord',
		description: 'Gemeinsam genutztes Werkzeug in der Nachbarschaft.',
		owner: owner.id,
		isPublic: false,
	});
	await addMember(pb, nord.id, member.id);
	await addMember(pb, nord.id, friend.id);

	// [name, category, ownerId, status?] — mixed owners, several categories, a few unavailable.
	const nordItems = [
		['Schlagbohrmaschine', 'Werkzeug und Garten', owner.id],
		['Rasenmäher', 'Werkzeug und Garten', owner.id, 'unavailable'],
		['Bohrhammer', 'Werkzeug und Garten', owner.id],
		['Leiter (3 m)', 'Werkzeug und Garten', owner.id],
		['Hochdruckreiniger', 'Werkzeug und Garten', friend.id],
		['Heckenschere', 'Werkzeug und Garten', friend.id],
		['Bollerwagen', 'Reisen und Outdoor', friend.id],
		['Campingzelt (4 Personen)', 'Reisen und Outdoor', member.id],
		['Schlafsack', 'Reisen und Outdoor', friend.id],
		['Full-HD-Beamer', 'Elektronik', owner.id],
		['Bluetooth-Box', 'Ton und Licht', friend.id, 'unavailable'],
		['Nähmaschine', 'Sonstiges', owner.id],
		['Waffeleisen', 'Küche', member.id],
		['Raclette-Grill', 'Küche', friend.id],
		['Brettspiel-Sammlung', 'Spiele', owner.id, 'unavailable'],
		['Kinderfahrrad', 'Für Kinder', friend.id],
	];
	for (const [name, category, ownerId, status] of nordItems) {
		await sharedItem(pb, nord.id, ownerId, name, category, status);
	}

	// Group 2: owned by grp_member_seed (management view).
	const sued = await pb.collection('groups').create({
		name: 'Nachbarschaft Süd',
		description: 'Kleine Leihgruppe im Süden.',
		owner: member.id,
		isPublic: false,
	});
	await addMember(pb, sued.id, friend.id);

	const suedItems = [
		['Mini-Beamer', 'Elektronik', member.id],
		['Fondue-Set', 'Küche', friend.id],
		['Akkuschrauber', 'Werkzeug und Garten', member.id],
		['Akustikgitarre', 'Ton und Licht', friend.id],
	];
	for (const [name, category, ownerId, status] of suedItems) {
		await sharedItem(pb, sued.id, ownerId, name, category, status);
	}

	// Control: a public item of grp_owner_seed shared with NO group — must not appear anywhere.
	await createItem(pb, owner.id, 'Privatbohrer (nicht geteilt)', ['Werkzeug und Garten']);

	return `  Login (password for all: "${USER_PASSWORD}"):
    grp_member_seed${SEED_DOMAIN}   ← log in as this user to test

  Groups:
    Werkzeugkreis Nord (member view)     → /user/groups/${nord.id}
        ${nordItems.length} shared items across many categories (3 unavailable), mixed owners
    Nachbarschaft Süd  (owner/admin view) → /user/groups/${sued.id}
        ${suedItems.length} shared items

  grp_owner_seed also owns "Privatbohrer (nicht geteilt)" — must NOT appear in any group list.`;
}
