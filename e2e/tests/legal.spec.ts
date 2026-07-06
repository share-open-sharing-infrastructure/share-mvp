import { test, expect } from '@playwright/test';
import { LOCKED_STORAGE_STATE } from '../fixtures/users';

/**
 * Legal-consent gate (Issue #399) — a locked account (declined the current terms) is
 * redirected to /legal/locked on any protected navigation. Runs as the seeded locked
 * user in the `multiuser` project.
 *
 * The accept/decline flow itself is not covered here: it requires an active
 * `legal_documents` row, but that collection is a backend-wide singleton (unique per
 * docType), so toggling it active for a test would gate every other user. Left for a
 * dedicated, isolated legal fixture.
 */

test.describe('legal', () => {
	test('a locked account is routed to the locked page', async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: LOCKED_STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			await page.goto('/');
			await expect(page).toHaveURL(/\/legal\/locked/);
			await expect(page.getByRole('heading', { name: 'Konto gesperrt' })).toBeVisible();
		} finally {
			await ctx.close();
		}
	});
});
