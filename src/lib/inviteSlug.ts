import type PocketBase from 'pocketbase';

const adjectives = [
	'happy', 'friendly', 'open', 'kind', 'warm', 'bright', 'merry', 'sunny',
	'bold', 'fair', 'gentle', 'lively', 'neat', 'swift', 'glad',
];

const verbs = [
	'share', 'lend', 'give', 'help', 'trust', 'offer', 'swap', 'borrow', 'connect', 'unite',
];

const nouns = [
	'team', 'gift', 'bond', 'link', 'care', 'joy', 'friend', 'grace', 'circle', 'crew',
];

function pick(arr: string[]): string {
	return arr[Math.floor(Math.random() * arr.length)];
}

export async function generateInviteSlug(pb: PocketBase): Promise<string> {
	for (let i = 0; i < 10; i++) {
		const slug = `${pick(adjectives)}-${pick(verbs)}-${pick(nouns)}`;
		try {
			await pb.collection('users').getFirstListItem(`inviteCode = "${slug}"`);
			// slug already taken — retry
		} catch {
			// getFirstListItem throws when no record found, meaning slug is free
			return slug;
		}
	}
	// Fallback after 10 collisions (extremely unlikely with a small user base)
	return crypto.randomUUID();
}
