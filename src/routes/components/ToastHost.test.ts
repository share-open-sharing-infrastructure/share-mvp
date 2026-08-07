import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ToastHost from './ToastHost.svelte';

describe('ToastHost', () => {
	// Attribute-level check only: the container must carry the stable `data-toast-host`
	// relocation hook (#523 — it's portalled into open modal dialogs so toasts paint above
	// the dialog backdrop) and be a persistent polite live region. SSR render is used
	// deliberately — the portal $effect never runs server-side, and jsdom has no modal
	// dialog / ::backdrop to exercise the relocation anyway.
	it('renders the container with the data-toast-host hook as a polite live region', () => {
		const html = render(ToastHost).body;
		expect(html).toContain('data-toast-host');
		expect(html).toContain('aria-live="polite"');
	});
});
