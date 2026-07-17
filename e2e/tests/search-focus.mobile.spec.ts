import { test, expect, devices } from '@playwright/test';

/**
 * Mobile (touch) counterpart to `search-focus.spec.ts` (#453). Split into its own file
 * because the Pixel-5 preset sets `defaultBrowserType`, which Playwright only permits at
 * the top level of a spec — not inside a `test.describe` group. `/search` is public, so
 * this runs in the `public` project without auth setup.
 */
test.use({ ...devices['Pixel 5'] });

test('search bar is NOT autofocused on load on touch devices (no keyboard pop)', async ({
	page,
}) => {
	await page.goto('/search');

	const input = page.getByRole('searchbox');
	await expect(input).toBeVisible();
	// Touch device (coarse pointer, no hover) → the mount-focus heuristic is skipped.
	await expect(input).not.toBeFocused();
});
