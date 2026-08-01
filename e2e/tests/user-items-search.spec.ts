import { test, expect, type Page } from '@playwright/test';
import { expectFieldsSurvivePreHydration } from '../fixtures/preHydration';

/**
 * /user/items' search box mirrors `?search=` in the URL (#619, see docs/best-practices.md →
 * "URL-synced fields"). Runs in the `authenticated` project (owner storageState) — the seeded
 * owner owns "E2E Campingzelt", "E2E Bohrmaschine", "E2E Kochbuch", "E2E Beamer". No test writes
 * to the DB, so this file is fullyParallel-safe.
 */

const PUBLIC_ITEM = 'E2E Campingzelt';
const OTHER_ITEM = 'E2E Bohrmaschine';

/**
 * Navigates and waits past hydration before returning. Without this, `.fill()` right after a
 * plain `page.goto()` reliably lands in the *same* pre-hydration window the first test below
 * targets on purpose (in dev, Playwright's next command outruns module execution): bind_value
 * would adopt the fill as an "override", and #619's onMount replay (+page.svelte) would then
 * fire its own (correct, but different) navigation — not the plain debounced one these tests
 * mean to exercise. Waiting for the root layout's post-load `__data.json` request reliably means
 * onMount has already run (and, for the core-regression test below, already had its one-shot
 * replay be a no-op).
 */
async function gotoHydrated(page: Page, path: string) {
	const dataJsonPromise = page.waitForResponse('**/__data.json*');
	await page.goto(path);
	await dataJsonPromise;
}

function searchBox(page: Page) {
	return page.getByRole('searchbox', { name: 'Suchen...' });
}

test.describe('user items search box (#619)', () => {
	test('text typed before hydration survives it (ratchet, see preHydration.ts)', async ({
		page,
	}) => {
		// Honest caveat (documented once for every caller in preHydration.ts): if hydration wins
		// the race this passes trivially, since a correctly-hydrated field holds the typed text
		// either way. It can never be *falsely* red — only red if the regression is genuinely back.
		await expectFieldsSurvivePreHydration(page, '/user/items', {
			'input[type="search"]': PUBLIC_ITEM,
		});
	});

	test('a spurious invalidate that leaves the search term unchanged does not overwrite typed text (core regression)', async ({
		page,
	}) => {
		// Fully hydrated first: onMount's replay (+page.svelte) already had its one shot — the
		// box was still empty when it ran, so it was a no-op — and it cannot fire a second time,
		// so it cannot heal a clobber that happens below.
		await gotoHydrated(page, '/user/items');
		const box = searchBox(page);
		// The status filter — the only combobox on /user/items today. If a second one ever lands
		// here (sorting, category filter), this needs a name to stay unambiguous.
		const statusSelect = page.getByRole('combobox');

		// The box's own debounced navigation (300ms after fill, see the test below) also hits
		// `__data.json` and — being a *real* `?search=` change — would correctly re-sync
		// `loadedSearch` and heal a clobber if it landed here. Block it forever by URL so it can
		// never interfere with this test, however slow a CI run is; every other `__data.json`
		// request (there is exactly one below) goes through untouched. Deliberately *not*
		// `route.abort()`: a failed `__data.json` fetch trips SvelteKit's hard-navigation
		// fallback, i.e. an uncontrolled page reload mid-test, instead of the navigation simply
		// never landing.
		await page.route('**/__data.json*', async (route) => {
			if (route.request().url().includes('search=')) return; // never resolves — by design
			await route.continue();
		});

		await box.fill(PUBLIC_ITEM);
		await expect(box).toHaveValue(PUBLIC_ITEM);

		// Change the status filter — any navigation re-runs the root layout's load, which
		// `afterNavigate` unconditionally invalidates (src/routes/+layout.svelte:28-35, the same
		// call that fires after the very first page load too). The resulting `data` is a fresh
		// object even though `data.search` is still '' — the URL never carried `search=` — which
		// is exactly the "identity churn, unchanged value" shape #619 is about. Driving it via
		// the status filter, rather than racing the first-load invalidate against hydration,
		// makes the repro deterministic instead of depending on exactly when hydration lands
		// relative to the fill.
		const invalidated = page.waitForResponse(
			(r) => r.url().includes('__data.json') && !r.url().includes('search=')
		);
		await statusSelect.selectOption('available');
		await invalidated;

		// A polling `toHaveValue` here would NOT prove anything: without the absorber the box
		// does go empty the instant the invalidate above is processed — measured directly, not
		// inferred — but Svelte's own reactivity heals it again within roughly a frame or two (a
		// side effect of `bind:value`'s input-event handling, not #619's onMount replay, and not
		// something this test relies on). A web-first assertion polls until it matches, so it
		// would just wait out that recovery and pass regardless of the intervening clobber — it
		// cannot tell "never went empty" apart from "went empty, then recovered". Read the value
		// with a single, non-retrying snapshot instead, timed to land inside that window: wait
		// one settle point past the invalidate (two animation frames —
		// comfortably longer than Svelte's own effect flush, comfortably shorter than the 300ms
		// debounce that would otherwise heal it again) and check exactly that snapshot.
		await page.evaluate(
			() =>
				new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve))
				)
		);
		expect(await box.inputValue()).toBe(PUBLIC_ITEM); // #619
	});

	test("the box's own debounced navigation is idempotent and keeps focus", async ({
		page,
	}) => {
		await gotoHydrated(page, '/user/items');
		const box = searchBox(page);

		await box.fill(PUBLIC_ITEM);
		await expect(page).toHaveURL(/[?&]search=E2E\+Campingzelt/); // web-first, outlasts the debounce
		await expect(box).toHaveValue(PUBLIC_ITEM);
		await expect(box).toBeFocused(); // keepFocus
		await expect(page.getByRole('link', { name: PUBLIC_ITEM })).toBeVisible();
		await expect(page.getByRole('link', { name: OTHER_ITEM })).toBeHidden();
	});

	test('back/forward re-syncs the box from the URL', async ({ page }) => {
		await gotoHydrated(page, '/user/items');
		const box = searchBox(page);

		await box.fill(PUBLIC_ITEM);
		await expect(page).toHaveURL(/[?&]search=E2E\+Campingzelt/);
		await expect(page.getByRole('link', { name: OTHER_ITEM })).toBeHidden();

		await page.goBack();
		await expect(box).toHaveValue('');
		await expect(page.getByRole('link', { name: OTHER_ITEM })).toBeVisible();

		await page.goForward();
		await expect(box).toHaveValue(PUBLIC_ITEM);
	});
});
