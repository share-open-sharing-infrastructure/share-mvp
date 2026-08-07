import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SegmentedControl from './SegmentedControl.svelte';

const options = [
	{ value: 'all', label: 'Alle' },
	{ value: 'institution', label: 'Institutionen' },
	{ value: 'private', label: 'Personen' },
];

function renderControl(props: Record<string, unknown> = {}) {
	return render(SegmentedControl, {
		props: { options, value: 'all', label: 'Anbieter', ...props },
	}).body;
}

describe('SegmentedControl', () => {
	it('renders one button per option with its label', () => {
		const html = renderControl();
		expect(html).toContain('Alle');
		expect(html).toContain('Institutionen');
		expect(html).toContain('Personen');
	});

	it('marks the active option with aria-checked="true" and the rest false', () => {
		const html = renderControl({ value: 'institution' });
		const buttons = html.split('<button').slice(1);
		expect(buttons[0]).toContain('aria-checked="false"'); // Alle
		expect(buttons[1]).toContain('aria-checked="true"'); // Institutionen
		expect(buttons[2]).toContain('aria-checked="false"'); // Personen
	});

	it('applies the active styling classes only to the selected option', () => {
		const html = renderControl({ value: 'private' });
		const buttons = html.split('<button').slice(1);
		expect(buttons[2]).toContain('bg-primary');
		expect(buttons[0]).not.toContain('bg-primary');
	});

	it('exposes an accessible group label', () => {
		const html = renderControl({ label: 'Anbieter' });
		expect(html).toContain('role="radiogroup"');
		expect(html).toContain('aria-label="Anbieter"');
	});
});
