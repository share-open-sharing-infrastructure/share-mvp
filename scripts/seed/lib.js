/**
 * Shared helpers for seed scenarios (see scripts/seed.js for the runner).
 *
 * Everything a scenario creates must use the `@seed.test` email domain for its users,
 * so `teardown()` can reliably find and remove prior seed data without touching real
 * records. Scenarios should build their data through the exported factories.
 */
import PocketBase from 'pocketbase';
import zlib from 'node:zlib';

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

// Tiny dependency-free PNG encoder so seeded items carry a real (offline, deterministic)
// image instead of just the category placeholder. Each item gets a solid card whose colour
// is derived from its name, so the seeded items look distinct when clicking through.
const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();
function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const typeBuf = Buffer.from(type, 'ascii');
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
	return Buffer.concat([len, typeBuf, data, crc]);
}
function solidPng(w, h, [r, g, b]) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0);
	ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // colour type: truecolour RGB
	const row = Buffer.alloc(1 + w * 3); // leading filter byte (0) + RGB pixels
	for (let x = 0; x < w; x++) [row[1 + x * 3], row[1 + x * 3 + 1], row[1 + x * 3 + 2]] = [r, g, b];
	const raw = Buffer.concat(Array.from({ length: h }, () => row));
	const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}
function hsvToRgb(h, s, v) {
	const c = v * s,
		x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
		m = v - c;
	const [r, g, b] =
		h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
	return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** A deterministic solid-colour PNG (640×420) as an upload, coloured from the name. */
export function placeholderImage(name) {
	let hash = 0;
	for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	const png = solidPng(640, 420, hsvToRgb(hash % 360, 0.5, 0.8));
	const file = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'}.png`;
	return typeof File !== 'undefined'
		? new File([png], file, { type: 'image/png' })
		: new Blob([png], { type: 'image/png' });
}

export function createItem(pb, ownerId, name, categories, opts = {}) {
	const data = {
		name,
		description: opts.description ?? `${name} (Testdaten)`,
		place: opts.place ?? 'Kassel',
		owner: ownerId,
		status: opts.status ?? 'available',
		trusteesOnly: opts.trusteesOnly ?? false,
		categories,
	};
	// Items get a generated placeholder image by default. Opt out with `withImage: false`,
	// or supply your own File/Blob via `image`. The PocketBase SDK detects the File and
	// uploads it as multipart.
	const image = opts.image ?? (opts.withImage === false ? null : placeholderImage(name));
	if (image) data.image = image;
	return pb.collection('items').create(data);
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
