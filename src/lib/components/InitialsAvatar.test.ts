import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import InitialsAvatar, { COLOR_PALETTE, hashString } from './InitialsAvatar.svelte';

function renderAvatar(props: { name: string } & Record<string, unknown>) {
	return render(InitialsAvatar, { props }).body;
}

describe('InitialsAvatar', () => {
	it('renders up to two uppercased initials from the name', () => {
		expect(renderAvatar({ name: 'Alice Example' })).toContain('>AE<');
		expect(renderAvatar({ name: 'bob' })).toContain('>B<');
	});

	it('exposes an accessible label and role', () => {
		const html = renderAvatar({ name: 'Alice Example' });
		expect(html).toContain('role="img"');
		expect(html).toContain('aria-label="Alice Example"');
	});

	it('forwards the class prop alongside the palette classes', () => {
		const html = renderAvatar({ name: 'Erin', class: 'h-9 w-9 rounded-full' });
		expect(html).toContain('h-9 w-9 rounded-full');
	});

	it('gives a name a stable colour', () => {
		// The real guard against re-introducing Math.random/Date into the hash: same name,
		// same markup, so SSR and CSR can't disagree.
		expect(renderAvatar({ name: 'Carol' })).toBe(renderAvatar({ name: 'Carol' }));
	});

	it('spreads realistic usernames evenly across the whole palette', () => {
		// Generated rather than hand-written, so the sample is large enough to say anything
		// about the distribution: first name × surname × the separators people actually use.
		const firstNames = [
			'anna', 'max', 'lena', 'paul', 'mia', 'finn', 'emma', 'noah',
			'lea', 'ben', 'jonas', 'sophie', 'luca', 'marie', 'felix', 'klara',
			'tim', 'hanna', 'jan', 'nele', 'leon', 'clara', 'david', 'julia',
		];
		const surnames = ['mueller', 'schmidt', 'weber', 'fischer', 'becker', 'wagner', 'schulz', 'hoffmann'];
		const separators = ['', '.', '_'];
		const usernames = firstNames.flatMap((first) =>
			surnames.flatMap((last) => separators.map((sep) => `${first}${sep}${last}`))
		);
		expect(usernames).toHaveLength(576);

		// Counted off `hashString` directly, not scraped out of the rendered markup: a
		// `/\bbg-\S+/` match on the HTML grabs whichever `bg-` class a caller happened to
		// pass through `class`, so it can pass while the palette pick is wrong.
		const buckets = new Array<number>(COLOR_PALETTE.length).fill(0);
		for (const name of usernames) buckets[hashString(name) % COLOR_PALETTE.length] += 1;

		expect(buckets.filter((count) => count === 0)).toEqual([]);
		expect(Math.max(...buckets) / usernames.length).toBeLessThanOrEqual(0.4);

		// The load-bearing assertion. Pearson chi-square against a uniform expectation,
		// 3 df: ~2.1 with the hash's xor-shift/multiply tail, ~22.0 without it, so deleting
		// that tail fails here. Neither check above catches it — `% 4` on the bare
		// 31-multiplier still fills all four buckets, worst case ~32 %.
		const expected = usernames.length / COLOR_PALETTE.length;
		const chiSquare = buckets.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);
		expect(chiSquare).toBeLessThan(10);
	});
});
