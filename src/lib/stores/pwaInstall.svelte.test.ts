import { describe, it, expect } from 'vitest';
import { PwaInstall, type BeforeInstallPromptEvent } from './pwaInstall.svelte';

/** A stand-in for the browser's `beforeinstallprompt` event with a fixed choice. */
function fakePrompt(outcome: 'accepted' | 'dismissed'): BeforeInstallPromptEvent {
	return {
		prompt: async () => {},
		userChoice: Promise.resolve({ outcome }),
	} as BeforeInstallPromptEvent;
}

describe('PwaInstall', () => {
	it('cannot prompt before an event is captured', () => {
		const store = new PwaInstall();
		expect(store.canPrompt).toBe(false);
	});

	it('captures the deferred prompt and reports it can prompt', () => {
		const store = new PwaInstall();
		store.capture(fakePrompt('accepted'));
		expect(store.canPrompt).toBe(true);
	});

	it('returns "unavailable" and stays not-installed when there is no prompt', async () => {
		const store = new PwaInstall();
		expect(await store.prompt()).toBe('unavailable');
		expect(store.installed).toBe(false);
	});

	it('marks installed and clears the (single-use) event when accepted', async () => {
		const store = new PwaInstall();
		store.capture(fakePrompt('accepted'));
		expect(await store.prompt()).toBe('accepted');
		expect(store.installed).toBe(true);
		expect(store.canPrompt).toBe(false);
	});

	it('clears the event but does not mark installed when dismissed', async () => {
		const store = new PwaInstall();
		store.capture(fakePrompt('dismissed'));
		expect(await store.prompt()).toBe('dismissed');
		expect(store.installed).toBe(false);
		expect(store.canPrompt).toBe(false);
	});

	it('markInstalled sets installed and drops any pending prompt', () => {
		const store = new PwaInstall();
		store.capture(fakePrompt('accepted'));
		store.markInstalled();
		expect(store.installed).toBe(true);
		expect(store.canPrompt).toBe(false);
	});
});
