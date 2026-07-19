// Shared PWA-install state. The browser fires `beforeinstallprompt` at most once
// (Chrome/Edge), so the captured event has to be stashed somewhere both the
// bottom-right pop-up (PwaPrompts.svelte) and the /misc/app page can reach — hence
// a singleton store rather than layout-local state. Same runes-class pattern as
// navigationLoader.svelte.ts.

/** The subset of the non-standard `beforeinstallprompt` event we use. */
export interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export class PwaInstall {
	/** The deferred install prompt, once the browser has offered one. */
	event = $state<BeforeInstallPromptEvent | null>(null);
	/** Set once the app has been installed (via prompt acceptance or the `appinstalled` event). */
	installed = $state(false);

	/** True when a native install prompt can be triggered right now (Chrome/Edge). */
	get canPrompt(): boolean {
		return this.event !== null;
	}

	/** Stash the browser's deferred `beforeinstallprompt` event for later use. */
	capture(e: BeforeInstallPromptEvent): void {
		this.event = e;
	}

	/** Mark the app as installed and drop the now-spent prompt (fired from `appinstalled`). */
	markInstalled(): void {
		this.installed = true;
		this.event = null;
	}

	/**
	 * Trigger the native install prompt and await the user's choice. A prompt can
	 * only be used once, so the event is cleared afterwards regardless of outcome.
	 * Returns 'unavailable' when no prompt was captured (Firefox / iOS / already installed).
	 */
	async prompt(): Promise<InstallOutcome> {
		const event = this.event;
		if (!event) return 'unavailable';
		await event.prompt();
		const { outcome } = await event.userChoice;
		this.event = null;
		if (outcome === 'accepted') this.installed = true;
		return outcome;
	}
}

export const pwaInstall = new PwaInstall();
