import { describe, it, expect } from 'vitest';
import { NavigationLoader, type TrackableNavigation } from './navigationLoader.svelte';

/**
 * A navigation whose `complete` promise we can resolve or reject on demand, mirroring
 * SvelteKit settling a navigation on success vs. failure/cancel.
 */
function deferredNavigation(willUnload = false): {
	nav: TrackableNavigation;
	finish: () => void;
	cancel: () => void;
} {
	let finish!: () => void;
	let cancel!: () => void;
	const complete = new Promise<void>((resolve, reject) => {
		finish = () => resolve();
		// Swallow at the source too: the controller attaches a rejection handler, but a
		// test that never awaits shouldn't emit an unhandled rejection.
		cancel = () => reject(new Error('aborted'));
	});
	complete.catch(() => {});
	return { nav: { willUnload, complete }, finish, cancel };
}

describe('NavigationLoader', () => {
	it('activates when a client-side navigation starts', () => {
		const loader = new NavigationLoader();
		loader.track(deferredNavigation().nav);
		expect(loader.active).toBe(true);
	});

	it('clears once the navigation completes successfully', async () => {
		const loader = new NavigationLoader();
		const { nav, finish } = deferredNavigation();
		loader.track(nav);
		finish();
		await nav.complete;
		expect(loader.active).toBe(false);
	});

	// The #482 / #346 regression: a cancelled/aborted navigation rejects `complete`,
	// and the overlay must clear — afterNavigate never fires on this path.
	it('clears when the navigation is cancelled (complete rejects)', async () => {
		const loader = new NavigationLoader();
		const { nav, cancel } = deferredNavigation();
		loader.track(nav);
		expect(loader.active).toBe(true);
		cancel();
		await nav.complete.catch(() => {});
		expect(loader.active).toBe(false);
	});

	it('ignores full-page unloads (never activates for them)', () => {
		const loader = new NavigationLoader();
		loader.track(deferredNavigation(true).nav);
		expect(loader.active).toBe(false);
	});

	// A superseded navigation settling later must not hide the overlay while a newer
	// navigation is still running.
	it('a superseded navigation does not clear the overlay for a newer one', async () => {
		const loader = new NavigationLoader();
		const first = deferredNavigation();
		const second = deferredNavigation();

		loader.track(first.nav);
		loader.track(second.nav);
		expect(loader.active).toBe(true);

		// The first (now superseded) navigation is aborted; the overlay must stay up.
		first.cancel();
		await first.nav.complete.catch(() => {});
		expect(loader.active).toBe(true);

		// Only when the latest navigation settles does the overlay clear.
		second.finish();
		await second.nav.complete;
		expect(loader.active).toBe(false);
	});
});
