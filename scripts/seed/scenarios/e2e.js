/**
 * Scenario: end-to-end test fixtures (Playwright, e2e/).
 *
 * Deterministic data owned by the Playwright suite. The seed runner tears down all
 * `@seed.test` data before seeding, so every run yields a known clean state.
 *
 *  - e2e_owner_seed  — login/owner. Owns public items, a trustees-only item, and two
 *                      groups (one public, one private with a fixed invite token).
 *  - e2e_viewer_seed — borrower/viewer. Trusted by the owner; member of the private group.
 *  - e2e_third_seed  — a third party. NOT trusted and not a group member (used to drive
 *                      "grant trust" and "join via invite token" flows from a clean slate).
 *  - e2e_stranger_seed — a pure bystander that NO test ever mutates. Used for assertions
 *                      that require a stably-untrusted user under `fullyParallel` (so a
 *                      concurrent trust test can't transiently flip the state).
 *
 * "E2E Bohrmaschine" is reserved for lending.spec, which drives a fresh request against it.
 * Login for all: password from lib.js (`password123`), email `<username>@seed.test`.
 */
import { createUser, createItem, setTrust, USER_PASSWORD, SEED_DOMAIN } from '../lib.js';

export const description =
	'End-to-end test fixtures (Playwright): owner + viewer + third user, a trust edge, public + trustees-only items, and a public and a private (invite-token) group.';

// Fixed so `/groups/join/<token>` is a stable URL for the invite-join test.
// Backend requires exactly 24 chars. Kept in sync with e2e/tests/groups.spec.ts.
const INVITE_TOKEN = 'e2ejointoken000000000000';

export async function run(pb) {
	const owner = await createUser(pb, 'e2e_owner_seed');
	const viewer = await createUser(pb, 'e2e_viewer_seed');
	await createUser(pb, 'e2e_third_seed');
	const stranger = await createUser(pb, 'e2e_stranger_seed');
	// Fresh un-onboarded user for onboarding.spec (seed users are hasOnboarded:true by default).
	await createUser(pb, 'e2e_newbie_seed', { hasOnboarded: false });
	// Legal-consent gate (Issue #399): a locked (declined-terms) account is redirected to
	// /legal/locked. The accept/decline flow itself needs toggling the backend's singleton
	// legal_documents active, which is too invasive for the shared local backend, so only
	// this non-invasive locked case is seeded. `legalLocked` is only settable via a
	// superuser update (create ignores it), so lock the account in a second step.
	const locked = await createUser(pb, 'e2e_locked_seed');
	await pb.collection('users').update(locked.id, { legalLocked: true });
	// Institutional account (unlocks the CSV bulk-import UI) for import.spec.
	await createUser(pb, 'e2e_institution_seed', { isInstitution: true });

	// Owner trusts viewer (viewer may see the owner's trustees-only items); third stays untrusted.
	await setTrust(pb, owner.id, [viewer.id]);

	// One notification for the stranger — its only one, so /notifications is deterministic
	// for notifications.spec even under fullyParallel (nothing else notifies the stranger).
	await pb.collection('notifications').create({
		recipient: stranger.id,
		sender: owner.id,
		type: 'trust_added',
		relatedId: owner.id,
		body: 'e2e_owner_seed vertraut dir jetzt',
		read: false,
	});

	// Reserved for lending.spec (driven fresh: search → request → …). Keep it public.
	const bohrmaschine = await createItem(pb, owner.id, 'E2E Bohrmaschine', [
		'Werkzeug und Garten',
	]);
	// Extra public items across categories for search render / filter / pagination.
	await createItem(pb, owner.id, 'E2E Campingzelt', ['Reisen und Outdoor']);
	await createItem(pb, owner.id, 'E2E Kochbuch', ['Bücher']);
	// "E2E Beamer" is reserved for conversation-read-on-open.spec: the viewer requests it
	// to open an unread-for-owner conversation, then the spec checks hover vs. click.
	await createItem(pb, owner.id, 'E2E Beamer', ['Ton und Licht']);
	// Trustees-only: visible to the owner's trustees (viewer), masked for third / strangers.
	const geheim = await createItem(pb, owner.id, 'E2E Geheimwerkzeug', ['Werkzeug und Garten'], {
		trusteesOnly: true,
	});

	// Public group — self-join surface (/groups/[id]).
	const publicGroup = await pb.collection('groups').create({
		name: 'E2E Öffentliche Gruppe',
		description: 'Öffentliche Gruppe zum Selbst-Beitreten.',
		owner: owner.id,
		isPublic: true,
	});
	// Private group — invite-token join, member management, and a shared item. The owner's
	// admin membership is created automatically by the backend group-create hook.
	const privateGroup = await pb.collection('groups').create({
		name: 'E2E Werkzeuggruppe',
		description: 'Private Gruppe mit geteilten Gegenständen.',
		owner: owner.id,
		isPublic: false,
	});
	await pb.collection('group_members').create({ group: privateGroup.id, user: viewer.id });
	await pb.collection('group_invites').create({
		group: privateGroup.id,
		token: INVITE_TOKEN,
		createdBy: owner.id,
	});
	// A shared item for the private group's detail page.
	const saege = await createItem(pb, owner.id, 'E2E Gruppen-Säge', ['Werkzeug und Garten']);
	await pb.collection('items').update(saege.id, { groups: [privateGroup.id] });

	return `  Login (password for all: "${USER_PASSWORD}"):
    e2e_owner_seed${SEED_DOMAIN}   (owner; trusts viewer; owns the groups below)
    e2e_viewer_seed${SEED_DOMAIN}  (trusted borrower; member of the private group)
    e2e_third_seed${SEED_DOMAIN}   (untrusted, no group — for grant-trust / join-token flows)
    e2e_stranger_seed${SEED_DOMAIN} (stable bystander — never mutated by any test)

  Items (owner):
    E2E Bohrmaschine (public)          → /items/${bohrmaschine.id}   [reserved for lending.spec]
    E2E Campingzelt / Kochbuch / Beamer (public, various categories)
      [Beamer reserved for conversation-read-on-open.spec, Kochbuch for messages.spec]
    E2E Geheimwerkzeug (trustees-only) → /items/${geheim.id}   [viewer sees it, third does not]

  Groups (owner):
    E2E Öffentliche Gruppe (public)    → /groups/${publicGroup.id}
    E2E Werkzeuggruppe (private)       → invite: /groups/join/${INVITE_TOKEN}`;
}
