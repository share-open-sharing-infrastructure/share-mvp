/**
 * Scenario: end-to-end test fixtures.
 *
 * Deterministic, minimal data owned by the Playwright suite (e2e/) so the tests do
 * not depend on any feature scenario's internals. The seed runner tears down all
 * `@seed.test` users before seeding, so running this yields a known clean state.
 *
 *  - e2e_owner_seed  — an ordinary owner with one public item, used as the login user.
 *  - e2e_viewer_seed — a second account for viewer-side flows.
 *
 * Login for both: password from lib.js (`password123`), email `<username>@seed.test`.
 */
import { createUser, createItem, USER_PASSWORD, SEED_DOMAIN } from '../lib.js';

export const description =
	'End-to-end test fixtures (Playwright): a login user with one public item.';

export async function run(pb) {
	const owner = await createUser(pb, 'e2e_owner_seed');
	await createUser(pb, 'e2e_viewer_seed');

	const bohrmaschine = await createItem(pb, owner.id, 'E2E Bohrmaschine', [
		'Werkzeug und Garten',
	]);

	return `  Login (password for all: "${USER_PASSWORD}"):
    e2e_owner_seed${SEED_DOMAIN}   (owner of the item below)
    e2e_viewer_seed${SEED_DOMAIN}  (second account)

  Items:
    E2E Bohrmaschine (public, owner) → /items/${bohrmaschine.id}`;
}
