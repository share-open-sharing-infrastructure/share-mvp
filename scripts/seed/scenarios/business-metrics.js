/**
 * Scenario: business metrics dashboard (/admin/metrics + /misc/stats).
 *
 * Seeds the underlying data the nightly metrics_daily job reads — NOT metrics_daily
 * rows themselves (those only exist once the job has run; see the walkthrough below).
 *
 *  - 3 private users (alice, bob, carol) + 1 institution (with a native item and an
 *    externally-synced item, so items.byPrivateUsers / byInstitutionsNative / external
 *    all have data).
 *  - 5 conversations spanning pending / accepted / rejected / aborted / completed.
 *    Two of them (carol->alice, bob->institution) go through REAL lendingStatus
 *    updates rather than being created directly in their final state, so the backend
 *    `lending_timestamps.pb.js` hook actually stamps acceptedAt/completedAt — without
 *    that, every 30-day/activeUsers/funnel figure would read as zero.
 *  - A trust edge, a public group with 2 members, an invited user, a push
 *    subscription, and an outbound click on the institution's external item — for
 *    community/integration metrics.
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
	'Business metrics: populates users/items/loans/community data across every metric group for /admin/metrics + /misc/stats.';

export async function run(pb) {
	const alice = await createUser(pb, 'alice_seed');
	const bob = await createUser(pb, 'bob_seed');
	const carol = await createUser(pb, 'carol_seed', { invitedBy: alice.id, verified: false });
	const institution = await createUser(pb, 'institution_seed', {
		isInstitution: true,
		city: 'Kassel',
		leihbackendUrl: 'https://beispiel-institution.example',
	});

	await setTrust(pb, alice.id, [bob.id]);

	const bohrmaschine = await createItem(pb, alice.id, 'Bohrmaschine', ['Werkzeug und Garten']);
	await createItem(pb, alice.id, 'Campingzelt', ['Reisen und Outdoor']);
	const kochbuch = await createItem(pb, bob.id, 'Kochbuch', ['Bücher']);
	await createItem(pb, bob.id, 'Heckenschere', ['Werkzeug und Garten']);
	const beamer = await createItem(pb, institution.id, 'Beamer', ['Ton und Licht']);
	const bohrerSet = await pb.collection('items').create({
		name: 'Bohrer-Set',
		description: 'Bohrer-Set (Testdaten, externer Katalog)',
		place: 'Kassel',
		owner: institution.id,
		status: 'available',
		trusteesOnly: false,
		categories: ['Werkzeug und Garten'],
		externalId: 'seed-ext-001',
		externalUrl: 'https://beispiel-institution.example/artikel/seed-ext-001',
	});

	// Completed loan: carol borrows alice's Bohrmaschine, taken through REAL status
	// updates so acceptedAt/completedAt get stamped (not just created at 'completed').
	const convCompleted = await createConversation(pb, {
		requester: carol.id,
		itemOwner: alice.id,
		requestedItem: bohrmaschine.id,
		messages: [
			await createMessage(pb, carol.id, alice.id, 'Hallo Alice, kann ich deine Bohrmaschine leihen?'),
			await createMessage(pb, alice.id, carol.id, 'Klar, gerne! Wann passt es dir?'),
		],
		readByRequester: true,
		readByOwner: true,
		lendingStatus: 'pending',
	});
	await pb.collection('conversations').update(convCompleted.id, { lendingStatus: 'accepted' });
	await pb.collection('conversations').update(convCompleted.id, { lendingStatus: 'active' });
	await pb.collection('conversations').update(convCompleted.id, { lendingStatus: 'return_requested' });
	await pb
		.collection('conversations')
		.update(convCompleted.id, { lendingStatus: 'completed', counterfactual: 'would_buy' });

	// Accepted (in-progress) loan: bob borrows the institution's Beamer — same real-update
	// treatment, so this contributes to loans.accepted30d / activeUsers too.
	const convAccepted = await createConversation(pb, {
		requester: bob.id,
		itemOwner: institution.id,
		requestedItem: beamer.id,
		messages: [await createMessage(pb, bob.id, institution.id, 'Hallo, ist der Beamer noch verfügbar?')],
		readByRequester: true,
		readByOwner: true,
		lendingStatus: 'pending',
	});
	await pb.collection('conversations').update(convAccepted.id, { lendingStatus: 'accepted' });

	// Rejected + aborted: created directly in their terminal state (no acceptedAt/completedAt
	// semantics apply to either, so a real transition chain adds nothing here).
	await createConversation(pb, {
		requester: carol.id,
		itemOwner: bob.id,
		requestedItem: kochbuch.id,
		messages: [await createMessage(pb, carol.id, bob.id, 'Kann ich dein Kochbuch ausleihen?')],
		readByRequester: true,
		readByOwner: true,
		lendingStatus: 'rejected',
	});
	await createConversation(pb, {
		requester: bob.id,
		itemOwner: alice.id,
		requestedItem: bohrmaschine.id,
		messages: [],
		readByRequester: true,
		readByOwner: true,
		lendingStatus: 'aborted',
	});

	// Still-pending request, undecided — feeds funnel.requests30d without resolving it.
	await createConversation(pb, {
		requester: alice.id,
		itemOwner: bob.id,
		requestedItem: kochbuch.id,
		messages: [],
		readByRequester: true,
		readByOwner: false,
		lendingStatus: 'pending',
	});

	// Community & integrations.
	const group = await pb
		.collection('groups')
		.create({ name: 'Nachbarschaft Seedtown', owner: alice.id, isPublic: true });
	// Group creation auto-adds the owner as an admin member (backend hook) — only add bob.
	await pb.collection('group_members').create({ group: group.id, user: bob.id, role: 'member' });

	await pb.collection('push_subscriptions').create({
		user: bob.id,
		endpoint: 'https://push.example.test/seed-bob',
		p256dh: 'seed-p256dh',
		auth: 'seed-auth',
	});

	await pb.collection('outbound_clicks').create({
		destination: bohrerSet.externalUrl,
		source_page: 'item-detail',
		item: bohrerSet.id,
	});

	return `  Login (password for all: "${USER_PASSWORD}"):
    alice_seed${SEED_DOMAIN} · bob_seed${SEED_DOMAIN} · carol_seed${SEED_DOMAIN} · institution_seed${SEED_DOMAIN}

  Walkthrough:
    1. Log in as an ADMIN_EMAILS-allowlisted user → /admin/metrics.
       The "Nutzer:innen"/"Gegenstände"/"Ausleihen" tiles are LIVE — they show real
       numbers immediately (4 users, 6 items across private/institutional-native/
       external, loans by status incl. 1 pending/1 accepted/1 rejected/1 aborted/1
       completed).
    2. Everything else (Aktive Nutzer:innen, Anfragen, Wirkung, Integrationen, Community,
       trend charts) comes from the nightly metrics_daily snapshot — it won't show
       until that job has run at least once. Trigger it manually: in the PocketBase
       admin UI, Settings -> Crons -> "metricsDailySnapshot" -> Run. (Or, if the backend
       was started with METRICS_TEST_ROUTE=true, POST /api/_test/run-metrics-snapshot
       as a superuser — see docs/operations/metrics.md.)
    3. Reload /admin/metrics — the snapshot-derived sections now show data: 1 completed
       loan with a "would_buy" impact answer, an acceptance rate around 67%, the
       institution's 2 items under "Integrationen", a public group with 2 members, a
       trust edge, an invited user, a push subscription, and 1 outbound click.
    4. Log out (or visit as any non-admin) -> /misc/stats shows the public headline
       numbers: registered users, items available, completed loans, and the impact count.`;
}
