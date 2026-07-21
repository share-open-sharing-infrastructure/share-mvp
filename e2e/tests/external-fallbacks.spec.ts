import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from '../fixtures/users';

/**
 * Tier-3 external services — assert the app degrades gracefully rather than driving the
 * real third-party round-trip (not deterministic locally). The geocode endpoint (ORS)
 * always returns a `{ suggestions: [] }`-shaped body and swallows errors, so with or
 * without an ORS key it yields a suggestions array. Fetched from the authenticated page
 * context so the auth cookie is sent.
 */

test.describe('external service fallbacks (T3)', () => {
	test('the geocode endpoint returns a suggestions array', async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			await page.goto('/');
			const json = await page.evaluate(() =>
				fetch('/api/geocode?q=Berlin').then((r) => r.json())
			);
			expect(Array.isArray(json.suggestions)).toBeTruthy();
		} finally {
			await ctx.close();
		}
	});
});
