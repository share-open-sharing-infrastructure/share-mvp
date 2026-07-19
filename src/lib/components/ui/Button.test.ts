import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import Button from './Button.svelte';

const label = createRawSnippet(() => ({ render: () => '<span>Klick</span>' }));

function renderButton(props: Record<string, unknown> = {}) {
	return render(Button, { props: { children: label, ...props } }).body;
}

describe('Button', () => {
	it('renders a <button type="button"> with primary/md styling by default', () => {
		const html = renderButton();
		expect(html).toContain('<button');
		expect(html).toContain('type="button"');
		expect(html).toContain('bg-primary-200');
		expect(html).toContain('rounded-full');
		expect(html).toContain('px-4 py-2 text-sm');
		expect(html).toContain('Klick');
	});

	it('renders an <a> when href is set', () => {
		const html = renderButton({ href: '/items/abc' });
		expect(html).toContain('<a');
		expect(html).toContain('href="/items/abc"');
		expect(html).not.toContain('<button');
	});

	it('disables the link variant via aria-disabled + pointer-events', () => {
		const html = renderButton({ href: '/x', disabled: true });
		expect(html).toContain('aria-disabled="true"');
		expect(html).toContain('pointer-events-none');
	});

	it('loading sets disabled, aria-busy and renders a spinner', () => {
		const html = renderButton({ loading: true });
		expect(html).toContain('disabled');
		expect(html).toContain('aria-busy="true"');
		expect(html).toContain('animate-spin');
	});

	it('applies variant and size classes', () => {
		expect(renderButton({ variant: 'danger' })).toContain('bg-danger');
		expect(renderButton({ variant: 'secondary' })).toContain('border-tinte-300');
		expect(renderButton({ size: 'icon' })).toContain('h-9 w-9');
		expect(renderButton({ size: 'xl' })).toContain('px-12 py-4 text-lg font-bold');
	});

	it('color swaps the primary variant fill without changing border/text', () => {
		const accent = renderButton({ color: 'accent' });
		expect(accent).toContain('bg-accent-200');
		expect(accent).toContain('hover:bg-accent');
		expect(accent).toContain('border-tinte-900');
		expect(accent).toContain('text-tinte-900');

		const secondary = renderButton({ color: 'secondary' });
		expect(secondary).toContain('bg-secondary-200');
		expect(secondary).toContain('hover:bg-secondary');
	});

	it('color has no effect on non-primary variants', () => {
		const html = renderButton({ variant: 'danger', color: 'accent' });
		expect(html).not.toContain('bg-accent-200');
		expect(html).toContain('bg-danger');
	});

	it('link variant has no padding box, only text size', () => {
		const html = renderButton({ variant: 'link', size: 'md' });
		expect(html).not.toContain('px-4 py-2');
		expect(html).toContain('text-sm');
	});

	it('appends fullWidth and pass-through classes', () => {
		const html = renderButton({ fullWidth: true, class: 'mt-4' });
		expect(html).toContain('w-full');
		expect(html).toContain('mt-4');
	});

	it('forwards submit type and name/value attributes', () => {
		const html = renderButton({ type: 'submit', name: 'intent', value: 'save' });
		expect(html).toContain('type="submit"');
		expect(html).toContain('name="intent"');
		expect(html).toContain('value="save"');
	});
});
