import { test, expect } from '@playwright/test';
import { STRANGER_STORAGE_STATE, STRANGER } from '../fixtures/users';

/**
 * Account — the GDPR data export (Art. 15/20). Fetches the export endpoint from within
 * the authenticated page context (so the pb_auth cookie is sent) and confirms it returns
 * the user's own data. (Account deletion is destructive and covered separately.)
 */

test.describe('account', () => {
	test('data export returns the user’s data', async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: STRANGER_STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			await page.goto('/');
			const body = await page.evaluate(() =>
				fetch('/user/account/export').then((r) => r.text())
			);
			// The export includes the account's own identifying data.
			expect(body).toContain(STRANGER.email);
		} finally {
			await ctx.close();
		}
	});
});
