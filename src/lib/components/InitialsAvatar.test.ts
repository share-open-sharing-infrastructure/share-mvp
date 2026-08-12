import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import InitialsAvatar from './InitialsAvatar.svelte';

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

	it('gives a name a stable colour, and spreads names across the palette', () => {
		expect(renderAvatar({ name: 'Carol' })).toBe(renderAvatar({ name: 'Carol' }));

		// Guards the hash's distribution, not just its stability: `% 4` reads only the low
		// bits, so an unmixed hash would pile these onto one or two colours.
		const names = ['anna', 'max', 'lena', 'paul', 'mia', 'finn', 'emma', 'noah', 'lea', 'ben'];
		const backgrounds = new Set(names.map((name) => renderAvatar({ name }).match(/\bbg-\S+/)?.[0]));
		expect(backgrounds.size).toBeGreaterThanOrEqual(3);
	});
});
