import { expect, type Page } from '@playwright/test';

/**
 * Assert that text typed into server-rendered form fields *before* the page hydrates survives
 * hydration — the #558/#613 bug class (docs/best-practices.md → "Editable fields: seed-once +
 * `bind:`, never one-way `value=`"), where the client's first value pass wrote the loaded value
 * over whatever the user had already typed into the SSR HTML.
 *
 * `waitUntil: 'commit'` returns as soon as the SSR HTML starts arriving, so the fills land in the
 * window before the client modules run — large in dev, where a route also compiles on first hit.
 *
 * **The caveat, stated once for every caller:** this is a ratchet, not a proof. If hydration wins
 * the race the assertion passes trivially, because a correctly-hydrated field holds the typed text
 * either way. So it can never be *falsely* red — it fails only if the regression is genuinely
 * back — but a green run is not evidence that the pre-hydration window was actually hit.
 *
 * Submits nothing, so it writes nothing to the database and cannot collide with a test running
 * concurrently under `fullyParallel` (including one that saves the same seed record).
 *
 * All fields are filled before any is asserted, so a multi-field page spends as little time as
 * possible in the pre-hydration window.
 *
 * @param page   a page in a context already carrying the right storage state
 * @param path   app-relative path to open, e.g. `/user/profile`
 * @param fields CSS selector → text to type. Selectors rather than the repo's usual role/label
 *               locators because the bug is specifically about the field's `name` attribute
 *               surviving into the hydrated DOM.
 */
export async function expectFieldsSurvivePreHydration(
	page: Page,
	path: string,
	fields: Record<string, string>
): Promise<void> {
	const entries = Object.entries(fields);

	await page.goto(path, { waitUntil: 'commit' });

	for (const [selector, value] of entries) {
		await page.locator(selector).fill(value);
	}
	for (const [selector, value] of entries) {
		await expect(page.locator(selector)).toHaveValue(value);
	}
}
