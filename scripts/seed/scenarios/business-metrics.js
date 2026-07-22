/**
 * Scenario: business metrics dashboard (/admin/metrics + /misc/stats).
 *
 * Seeds the underlying data the nightly metrics_daily job reads (users, items,
 * conversations, trust/group/push/click activity) AND ~2 weeks of historical
 * metrics_daily rows directly, so the trend sparklines have something to show
 * immediately instead of needing 13 real nightly runs. Today's row is deliberately
 * left unseeded — trigger the real job once after seeding (see the walkthrough) so
 * "today" reflects the actual data below, and the trend line ends in a real number.
 *
 *  - 4 private users (alice, bob, carol, dave) + 2 institutions (one native+external
 *    item each), so items.byPrivateUsers / byInstitutionsNative / external /
 *    externalByInstitution all have data, and integrations.lastSyncByInstitution has 2 rows.
 *  - 8 conversations, one per lendingStatus (pending/accepted/rejected/active/
 *    return_requested/completed x2/aborted). The ones that reach accepted/active/
 *    return_requested/completed go through REAL lendingStatus updates (not created
 *    directly in their final state), so the backend `lending_timestamps.pb.js` hook
 *    actually stamps acceptedAt/completedAt — without that, every 30-day/activeUsers/
 *    funnel figure would read as zero. The two completed loans get different
 *    counterfactual answers so the impact breakdown isn't a single bar.
 *  - 3 trust edges, 2 groups (one public/one private) with extra members, 2 invited
 *    users, 2 push subscriptions, and 3 outbound clicks across both institutions.
 *  - alice_seed is seeded with isAdmin: true, so /admin/metrics is reachable
 *    immediately (the flag lives in the DB now, not an ADMIN_EMAILS env allowlist).
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
	'Business metrics: a fuller data set (all 7 lendingStatus values, 2 institutions, community activity) plus 13 days of historical metrics_daily rows, for /admin/metrics + /misc/stats.';

const HISTORY_DAYS = 13; // seeded days end YESTERDAY — today is left for the real job to compute

function daysAgoDateStr(n) {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - n);
	return d.toISOString().slice(0, 10);
}

/** A plausible, gently-trending DailyMetrics object for one historical day (demo data only). */
function historicalMetrics(dayIndex, totalDays) {
	const progress = totalDays > 1 ? dayIndex / (totalDays - 1) : 1;
	const usersTotal = Math.round(2 + 4 * progress);
	const itemsAvailable = Math.round(3 + 7 * progress);
	const loansCompleted = Math.round(2 * progress);
	const institutionsSoFar = progress > 0.15 ? (progress > 0.6 ? 2 : 1) : 0;

	return {
		users: { total: usersTotal, institutions: institutionsSoFar, verified: Math.max(0, usersTotal - 2) },
		items: {
			available: itemsAvailable,
			byPrivateUsers: Math.max(0, itemsAvailable - 2 * institutionsSoFar),
			byInstitutionsNative: institutionsSoFar,
			external: institutionsSoFar,
			externalByInstitution: [],
		},
		loans: {
			byStatus: {
				pending: 1,
				accepted: progress > 0.2 ? 1 : 0,
				rejected: progress > 0.3 ? 1 : 0,
				active: progress > 0.5 ? 1 : 0,
				return_requested: progress > 0.7 ? 1 : 0,
				completed: loansCompleted,
				aborted: progress > 0.4 ? 1 : 0,
			},
			completedTotal: loansCompleted,
			accepted30d: Math.min(4, Math.round(4 * progress)),
			completed30d: loansCompleted,
		},
		activeUsers: {
			loans30d_1plus: Math.round(2 + 4 * progress),
			loans30d_2plus: Math.round(2 * progress),
			login7d: usersTotal,
			login30d: usersTotal,
		},
		funnel: {
			requests30d: Math.round(3 + 6 * progress),
			acceptanceRate30d: progress > 0.15 ? Math.min(1, 0.4 + 0.3 * progress) : null,
			stalePending: 0,
		},
		messages: { total: Math.round(4 + 12 * progress), last30d: Math.round(4 + 12 * progress) },
		impact: {
			counterfactual: {
				pending: 0,
				would_buy: progress > 0.3 ? 1 : 0,
				not_important: progress > 0.8 ? 1 : 0,
				too_expensive: 0,
				borrow_elsewhere: 0,
				unsure: 0,
				skipped: 0,
			},
		},
		integrations: { lastSyncByInstitution: [] },
		outboundClicks: {
			total: Math.round(3 * progress),
			last30d: Math.round(3 * progress),
			byItemOwner30d: [],
			byDomain30d: [],
		},
		community: {
			groups: { total: progress > 0.5 ? 2 : 1, public: 1, memberships: Math.round(2 + 2 * progress) },
			trusts: { edges: Math.round(1 + 2 * progress) },
			invites: { usersInvited: Math.round(2 * progress) },
			push: { subscriptions: Math.round(2 * progress), usersSubscribed: Math.round(2 * progress) },
		},
	};
}

async function upsertMetricsDaily(pb, date, metrics) {
	let existing = null;
	try {
		existing = await pb.collection('metrics_daily').getFirstListItem(pb.filter('date = {:d}', { d: date }));
	} catch {
		existing = null;
	}
	if (existing) await pb.collection('metrics_daily').update(existing.id, { metrics });
	else await pb.collection('metrics_daily').create({ date, metrics });
}

/** Take a conversation through real lendingStatus updates so acceptedAt/completedAt get stamped. */
async function advanceLendingStatus(pb, conversationId, statuses, extraAtLast = {}) {
	for (let i = 0; i < statuses.length; i++) {
		const isLast = i === statuses.length - 1;
		await pb
			.collection('conversations')
			.update(conversationId, { lendingStatus: statuses[i], ...(isLast ? extraAtLast : {}) });
	}
}

export async function run(pb) {
	// isAdmin gates /admin/metrics — a DB flag now, not an env allowlist, so seeding
	// it directly here is enough to try the dashboard with no extra config.
	const alice = await createUser(pb, 'alice_seed', { isAdmin: true });
	const bob = await createUser(pb, 'bob_seed');
	const carol = await createUser(pb, 'carol_seed', { invitedBy: alice.id, verified: false });
	const dave = await createUser(pb, 'dave_seed', { invitedBy: bob.id, verified: false });
	const institutionA = await createUser(pb, 'institution_a_seed', {
		isInstitution: true,
		city: 'Kassel',
		leihbackendUrl: 'https://beispiel-institution-a.example',
	});
	const institutionB = await createUser(pb, 'institution_b_seed', {
		isInstitution: true,
		city: 'Göttingen',
		leihbackendUrl: 'https://beispiel-institution-b.example',
	});

	await setTrust(pb, alice.id, [bob.id]);
	await setTrust(pb, bob.id, [carol.id]);
	await setTrust(pb, carol.id, [dave.id]);

	const bohrmaschine = await createItem(pb, alice.id, 'Bohrmaschine', ['Werkzeug und Garten']);
	const campingzelt = await createItem(pb, alice.id, 'Campingzelt', ['Reisen und Outdoor']);
	const kochbuch = await createItem(pb, bob.id, 'Kochbuch', ['Bücher']);
	const heckenschere = await createItem(pb, bob.id, 'Heckenschere', ['Werkzeug und Garten']);
	const bollerwagen = await createItem(pb, carol.id, 'Bollerwagen', ['Freizeit und Sport']);
	const kettensaege = await createItem(pb, carol.id, 'Kettensäge', ['Werkzeug und Garten']);
	const beamer = await createItem(pb, institutionA.id, 'Beamer', ['Ton und Licht']);
	const bohrerSet = await pb.collection('items').create({
		name: 'Bohrer-Set',
		description: 'Bohrer-Set (Testdaten, externer Katalog)',
		place: 'Kassel',
		owner: institutionA.id,
		status: 'available',
		trusteesOnly: false,
		categories: ['Werkzeug und Garten'],
		externalId: 'seed-ext-001',
		externalUrl: 'https://beispiel-institution-a.example/artikel/seed-ext-001',
	});
	const naehmaschine = await createItem(pb, institutionB.id, 'Nähmaschine', ['Sonstiges']);
	const aktenvernichter = await pb.collection('items').create({
		name: 'Aktenvernichter',
		description: 'Aktenvernichter (Testdaten, externer Katalog)',
		place: 'Göttingen',
		owner: institutionB.id,
		status: 'available',
		trusteesOnly: false,
		categories: ['Elektronik'],
		externalId: 'seed-ext-002',
		externalUrl: 'https://beispiel-institution-b.example/artikel/seed-ext-002',
	});

	// 1. completed — carol borrows alice's Bohrmaschine (counterfactual: would_buy).
	const conv1 = await createConversation(pb, {
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
	await advanceLendingStatus(pb, conv1.id, ['accepted', 'active', 'return_requested', 'completed'], {
		counterfactual: 'would_buy',
	});

	// 2. accepted — bob borrows institutionA's Beamer.
	const conv2 = await createConversation(pb, {
		requester: bob.id,
		itemOwner: institutionA.id,
		requestedItem: beamer.id,
		messages: [await createMessage(pb, bob.id, institutionA.id, 'Hallo, ist der Beamer noch verfügbar?')],
		readByRequester: true,
		readByOwner: true,
		lendingStatus: 'pending',
	});
	await advanceLendingStatus(pb, conv2.id, ['accepted']);

	// 3. rejected — carol requests bob's Kochbuch.
	await createConversation(pb, {
		requester: carol.id,
		itemOwner: bob.id,
		requestedItem: kochbuch.id,
		messages: [await createMessage(pb, carol.id, bob.id, 'Kann ich dein Kochbuch ausleihen?')],
		readByRequester: true,
		readByOwner: true,
		lendingStatus: 'rejected',
	});

	// 4. aborted — bob requests alice's Campingzelt, then withdraws.
	await createConversation(pb, {
		requester: bob.id,
		itemOwner: alice.id,
		requestedItem: campingzelt.id,
		messages: [],
		readByRequester: true,
		readByOwner: true,
		lendingStatus: 'aborted',
	});

	// 5. pending — alice requests bob's Heckenschere, undecided.
	await createConversation(pb, {
		requester: alice.id,
		itemOwner: bob.id,
		requestedItem: heckenschere.id,
		messages: [],
		readByRequester: true,
		readByOwner: false,
		lendingStatus: 'pending',
	});

	// 6. active — dave borrows carol's Bollerwagen, currently out.
	const conv6 = await createConversation(pb, {
		requester: dave.id,
		itemOwner: carol.id,
		requestedItem: bollerwagen.id,
		messages: [await createMessage(pb, dave.id, carol.id, 'Hi Carol, kann ich den Bollerwagen ausleihen?')],
		readByRequester: true,
		readByOwner: true,
		lendingStatus: 'pending',
	});
	await advanceLendingStatus(pb, conv6.id, ['accepted', 'active']);

	// 7. return_requested — dave borrows institutionB's Nähmaschine, return in progress.
	const conv7 = await createConversation(pb, {
		requester: dave.id,
		itemOwner: institutionB.id,
		requestedItem: naehmaschine.id,
		messages: [await createMessage(pb, dave.id, institutionB.id, 'Ist die Nähmaschine verfügbar?')],
		readByRequester: true,
		readByOwner: true,
		lendingStatus: 'pending',
	});
	await advanceLendingStatus(pb, conv7.id, ['accepted', 'active', 'return_requested']);

	// 8. completed — bob borrows carol's Kettensäge (counterfactual: not_important — diversifies the impact chart).
	const conv8 = await createConversation(pb, {
		requester: bob.id,
		itemOwner: carol.id,
		requestedItem: kettensaege.id,
		messages: [await createMessage(pb, bob.id, carol.id, 'Kann ich deine Kettensäge leihen?')],
		readByRequester: true,
		readByOwner: true,
		lendingStatus: 'pending',
	});
	await advanceLendingStatus(pb, conv8.id, ['accepted', 'active', 'return_requested', 'completed'], {
		counterfactual: 'not_important',
	});

	// Community: a public group (alice, +bob) and a private one (carol, +dave).
	const publicGroup = await pb
		.collection('groups')
		.create({ name: 'Nachbarschaft Seedtown', owner: alice.id, isPublic: true });
	await pb.collection('group_members').create({ group: publicGroup.id, user: bob.id, role: 'member' });
	const privateGroup = await pb
		.collection('groups')
		.create({ name: 'Bücherclub Seedtown', owner: carol.id, isPublic: false });
	await pb.collection('group_members').create({ group: privateGroup.id, user: dave.id, role: 'member' });

	// Push subscriptions.
	await pb.collection('push_subscriptions').create({
		user: bob.id,
		endpoint: 'https://push.example.test/seed-bob',
		p256dh: 'seed-p256dh-bob',
		auth: 'seed-auth-bob',
	});
	await pb.collection('push_subscriptions').create({
		user: carol.id,
		endpoint: 'https://push.example.test/seed-carol',
		p256dh: 'seed-p256dh-carol',
		auth: 'seed-auth-carol',
	});

	// Outbound clicks — 2 on institutionA's item, 1 on institutionB's, so byItemOwner30d has 2 rows.
	await pb.collection('outbound_clicks').create({
		destination: bohrerSet.externalUrl,
		source_page: 'item-detail',
		item: bohrerSet.id,
	});
	await pb.collection('outbound_clicks').create({
		destination: bohrerSet.externalUrl,
		source_page: 'search',
		item: bohrerSet.id,
	});
	await pb.collection('outbound_clicks').create({
		destination: aktenvernichter.externalUrl,
		source_page: 'item-detail',
		item: aktenvernichter.id,
	});

	// 13 days of historical metrics_daily rows (yesterday back to 13 days ago) so the
	// trend sparklines show a line immediately. Demo data only — see the module docstring.
	for (let dayIndex = 0; dayIndex < HISTORY_DAYS; dayIndex++) {
		const date = daysAgoDateStr(HISTORY_DAYS - dayIndex);
		await upsertMetricsDaily(pb, date, historicalMetrics(dayIndex, HISTORY_DAYS));
	}

	return `  Login (password for all: "${USER_PASSWORD}"):
    alice_seed${SEED_DOMAIN} · bob_seed${SEED_DOMAIN} · carol_seed${SEED_DOMAIN} · dave_seed${SEED_DOMAIN}
    institution_a_seed${SEED_DOMAIN} · institution_b_seed${SEED_DOMAIN}

  Walkthrough:
    1. Log in as alice_seed (seeded with isAdmin: true) → /admin/metrics is reachable
       directly, and now also shows a nav link. The "Nutzer:innen"/"Gegenstände"/
       "Ausleihen" tiles are LIVE — 6 users, 10 items across private/institutional-
       native/external, and all 7 lendingStatus values represented under "Ausleihen".
    2. The trend charts already show a ~2-week upward line (seeded directly into
       metrics_daily) — but it stops at YESTERDAY. To get an accurate "today" and fill
       in Aktive Nutzer:innen / Anfragen / Wirkung / Integrationen / Community with the
       data just seeded above: PocketBase admin UI → Settings → Crons →
       "metricsDailySnapshot" → Run. (Or POST /api/_test/run-metrics-snapshot as a
       superuser if the backend was started with METRICS_TEST_ROUTE=true.)
    3. Reload /admin/metrics — "Wirkung" now shows 2 different counterfactual answers
       (would_buy, not_important), "Integrationen" lists both institutions with their
       item counts, "Community" shows 2 groups (1 public/1 private) with extra members,
       3 trust edges, 2 invited users, and 2 push subscriptions.
    4. Log out (or visit as any non-admin) → /misc/stats shows the public headline
       numbers.`;
}
