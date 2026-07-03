/**
 * Scenario: account deletion / GDPR (PR #248).
 *
 *  - alice_seed has an ACTIVE loan (borrowing bob's "Kochbuch") → deleting alice is
 *    blocked until that loan is completed.
 *  - bob_seed has a COMPLETED loan (borrowed alice's "Bohrmaschine") with messages both
 *    ways → after alice is deleted, bob still sees the conversation, anonymized to
 *    "Gelöschtes Konto".
 *  - alice ↔ bob trust each other; carla trusts alice; bob owns a trustees-only item.
 */
import {
	createUser,
	createItem,
	createMessage,
	createConversation,
	setTrust,
	USER_PASSWORD,
	SEED_DOMAIN,
} from '../lib.js';

export const description =
	'Account deletion: active loan blocks deletion; completed loan retained + anonymized.';

export async function run(pb) {
	const alice = await createUser(pb, 'alice_seed');
	const bob = await createUser(pb, 'bob_seed');
	const carla = await createUser(pb, 'carla_seed');

	await setTrust(pb, alice.id, [bob.id]);
	await setTrust(pb, bob.id, [alice.id]);
	await setTrust(pb, carla.id, [alice.id]);

	const drill = await createItem(pb, alice.id, 'Bohrmaschine', ['Werkzeug und Garten']);
	await createItem(pb, alice.id, 'Campingzelt', ['Reisen und Outdoor']);
	const cookbook = await createItem(pb, bob.id, 'Kochbuch', ['Bücher']);
	await createItem(pb, bob.id, 'Beamer', ['Ton und Licht'], { trusteesOnly: true });
	await createItem(pb, carla.id, 'Brettspiel', ['Spiele']);

	// Completed loan: bob borrowed alice's drill (retained + anonymized after alice deletes).
	await createConversation(pb, {
		requester: bob.id,
		itemOwner: alice.id,
		requestedItem: drill.id,
		messages: [
			await createMessage(pb, bob.id, alice.id, 'Hi Alice, kann ich deine Bohrmaschine leihen?'),
			await createMessage(pb, alice.id, bob.id, 'Klar, gerne! Wann passt es dir?'),
			await createMessage(pb, bob.id, alice.id, 'Super, habe sie abgeholt – danke!'),
			await createMessage(pb, bob.id, alice.id, 'Zurückgebracht, vielen Dank :)'),
		],
		readByRequester: true,
		readByOwner: true,
		lendingStatus: 'completed',
	});

	// Active loan: alice is borrowing bob's cookbook → this BLOCKS deleting alice.
	await createConversation(pb, {
		requester: alice.id,
		itemOwner: bob.id,
		requestedItem: cookbook.id,
		messages: [
			await createMessage(pb, alice.id, bob.id, 'Hallo Bob, darf ich dein Kochbuch ausleihen?'),
			await createMessage(pb, bob.id, alice.id, 'Ja klar, ich bringe es dir morgen vorbei.'),
		],
		readByRequester: true,
		readByOwner: false,
		lendingStatus: 'active',
	});

	return `  Login (password for all: "${USER_PASSWORD}"):
    alice_seed${SEED_DOMAIN} · bob_seed${SEED_DOMAIN} · carla_seed${SEED_DOMAIN}

  Walkthrough:
    1. Log in as alice → /user/account → delete is BLOCKED (active loan: borrowing bob's Kochbuch).
    2. As bob, confirm the return of the Kochbuch (loan → completed), then delete alice's account.
    3. Log in as bob → open the "Bohrmaschine" conversation → alice shows as "Gelöschtes Konto".
    4. Search no longer lists alice's items; her data export is available before deletion at /user/account.`;
}
