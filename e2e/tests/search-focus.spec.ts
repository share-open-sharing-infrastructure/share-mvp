import { test, expect } from '@playwright/test';

/**
 * Search-bar focus behaviour on desktop (#453). `/search` is a public route (reachable
 * while logged out), so these run in the `public` project without any auth setup.
 * The mobile (touch) counterpart lives in `search-focus.mobile.spec.ts` because the
 * Pixel-5 device preset sets `defaultBrowserType`, which Playwright only allows top-level.
 */

test.describe('search bar focus (desktop)', () => {
	test('autofocuses on load and keeps focus across the debounced auto-search', async ({
		page,
	}) => {
		await page.goto('/search');

		const input = page.getByRole('searchbox');
		await expect(input).toBeVisible();
		// Desktop (precise pointer / hover) → autofocus on mount.
		await expect(input).toBeFocused();

		// Typing ≥3 chars triggers a debounced client-side navigation …
		await input.pressSequentially('lampe');
		await expect(page).toHaveURL(/[?&]q=lampe(?:&|$)/);

		// … and focus survives it (keepFocus), so the user can keep typing without re-clicking.
		await expect(input).toBeFocused();
	});

	test('debounced auto-search replaces history instead of stacking entries', async ({
		page,
	}) => {
		await page.goto('/search');

		const input = page.getByRole('searchbox');
		await expect(input).toBeVisible();
		await expect(input).toBeFocused();

		// The submit establishes the search baseline that the goBack at the end returns to.
		// Asserting the URL here would be tautological: the page is already on /search (the
		// goto above), and an empty submit targets that very same URL — SearchBar's
		// handleSubmit calls goto(resolve('/search')) with no `q` param since #578
		// consolidated filters, so everything is shown by default. A URL check would pass
		// even if Enter did nothing at all. Assert what the submit actually *does* instead:
		// it pushes a real history entry (no replaceState), unlike the two auto-searches
		// below, and it leaves no `q` behind.
		const historyDepthBefore = await page.evaluate(() => history.length);
		await input.press('Enter');
		await expect
			.poll(() =>
				page.evaluate(() => ({
					depth: history.length,
					hasQ: new URL(location.href).searchParams.has('q'),
				}))
			)
			.toEqual({ depth: historyDepthBefore + 1, hasQ: false });

		// Two successive auto-searches, each awaited so both actually navigate.
		await input.pressSequentially('lampe');
		await expect(page).toHaveURL(/[?&]q=lampe(?:&|$)/);

		await input.pressSequentially('x');
		await expect(page).toHaveURL(/[?&]q=lampex(?:&|$)/);

		// Both auto-searches used replaceState, so a single back step skips the
		// intermediate queries and lands on the pre-search baseline (/search).
		await page.goBack();
		await expect(page).toHaveURL(/\/search$/);
	});
});
