// Global navigation loading-overlay state (driven by the root layout). Keyed off
// each navigation's `complete` promise, which — unlike afterNavigate — also settles
// when a navigation is cancelled or aborted (#482 / #346).

/** The slice of SvelteKit's `BeforeNavigate` this depends on; kept local so the store is unit-testable. */
export interface TrackableNavigation {
	willUnload: boolean;
	complete: Promise<void>;
}

export class NavigationLoader {
	active = $state(false);
	#token = 0;

	/** Wire to `beforeNavigate`: shows the overlay and clears it when the navigation settles. */
	track(navigation: TrackableNavigation): void {
		// willUnload navs' `complete` never resolves and the browser shows its own
		// spinner, so tracking them would strand the overlay if the user stays.
		if (navigation.willUnload) return;
		const token = ++this.#token;
		this.active = true;
		// Latest-nav guard: a superseded navigation must not clear a newer one's overlay.
		const clear = () => {
			if (token === this.#token) this.active = false;
		};
		// Same handler on resolve and reject — success and cancel/abort both end the nav.
		navigation.complete.then(clear, clear);
	}
}

export const navigationLoader = new NavigationLoader();
