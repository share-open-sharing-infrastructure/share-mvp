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

		// The submit establishes the search baseline; the two debounce auto-searches below
		// each replaceState, so they collapse into a single entry instead of stacking — a
		// single goBack therefore skips the intermediate queries and returns to /search.
		await input.press('Enter');
		await expect(page).toHaveURL(/[?&]q=\*/);

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
