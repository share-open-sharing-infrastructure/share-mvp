/**
 * Shared helpers for seed scenarios (see scripts/seed.js for the runner).
 *
 * Everything a scenario creates must use the `@seed.test` email domain for its users,
 * so `teardown()` can reliably find and remove prior seed data without touching real
 * records. Scenarios should build their data through the exported factories.
 */
import PocketBase from 'pocketbase';

export const SEED_DOMAIN = '@seed.test';
export const USER_PASSWORD = 'password123';

/** Connect to PocketBase and authenticate as a superuser (creds from env). */
export async function connect() {
	const url = process.env.PB_URL ?? 'http://127.0.0.1:8090';
	const email = process.env.PB_SUPERUSER_EMAIL;
	const password = process.env.PB_SUPERUSER_PASSWORD;
	if (!email || !password) {
		throw new Error(
			'Missing superuser credentials. Set PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD.'
		);
	}
	const pb = new PocketBase(url);
	pb.autoCancellation(false);
	await pb.collection('_superusers').authWithPassword(email, password);
	return pb;
}

async function deleteWhere(pb, collection, filter) {
	const rows = await pb.collection(collection).getFullList({ filter }).catch(() => []);
	for (const row of rows) await pb.collection(collection).delete(row.id).catch(() => {});
}

/**
 * Remove all data from any previous seed run (users on the `@seed.test` domain and
 * everything they own), so scenarios are re-runnable. Deletes in FK-safe order.
 */
export async function teardown(pb) {
	const seedUsers = await pb
		.collection('users')
		.getFullList({ filter: `email ~ "${SEED_DOMAIN}"` })
		.catch(() => []);
	if (seedUsers.length === 0) return 0;

	const ids = seedUsers.map((u) => u.id);
	const anyOf = (field) => '(' + ids.map((id) => `${field} = "${id}"`).join(' || ') + ')';

	await deleteWhere(pb, 'messages', `${anyOf('from')} || ${anyOf('to')}`);
	await deleteWhere(pb, 'conversations', `${anyOf('requester')} || ${anyOf('itemOwner')}`);
	await deleteWhere(pb, 'items', anyOf('owner'));
	for (const u of seedUsers) await pb.collection('users').delete(u.id).catch(() => {});
	return seedUsers.length;
}

// --- Factories -------------------------------------------------------------

export function createUser(pb, username, overrides = {}) {
	return pb.collection('users').create({
		username,
		email: `${username}${SEED_DOMAIN}`,
		password: USER_PASSWORD,
		passwordConfirm: USER_PASSWORD,
		verified: true,
		hasOnboarded: true,
		...overrides,
	});
}

export function createItem(pb, ownerId, name, categories, opts = {}) {
	return pb.collection('items').create({
		name,
		description: opts.description ?? `${name} (Testdaten)`,
		place: opts.place ?? 'Kassel',
		owner: ownerId,
		status: opts.status ?? 'available',
		trusteesOnly: opts.trusteesOnly ?? false,
		categories,
	});
}

export async function createMessage(pb, fromId, toId, content) {
	const msg = await pb.collection('messages').create({ messageContent: content, from: fromId, to: toId });
	return msg.id;
}

export function createConversation(pb, data) {
	return pb.collection('conversations').create(data);
}

export function setTrust(pb, userId, trustedIds) {
	return pb.collection('users').update(userId, { trusts: trustedIds });
}
