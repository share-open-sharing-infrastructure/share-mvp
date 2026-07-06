import { test, expect } from '@playwright/test';
import { VIEWER_STORAGE_STATE } from '../fixtures/users';

/**
 * Messaging — a borrower opens a conversation (by requesting an item) and sends a chat
 * message. Uses "E2E Kochbuch", a public item reserved for this spec so its conversation
 * doesn't collide with lending.spec (Bohrmaschine). Runs as the viewer in the `multiuser`
 * project.
 */

const ITEM = 'E2E Kochbuch';

test.describe('messages', () => {
	test('borrower sends a chat message in a conversation', async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: VIEWER_STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			// Start a conversation by requesting the item.
			await page.goto('/search?q=' + encodeURIComponent(ITEM));
			await page.getByRole('link', { name: ITEM }).first().click();
			await page.getByRole('button', { name: 'Anfragen' }).click();
			await expect(page).toHaveURL(/\/conversations\/[^/]+$/);

			// Send a message; it appears in the thread.
			const text = `E2E Nachricht ${Date.now()}`;
			await page.locator('input[name="messageContent"]').fill(text);
			await page.locator('form[action="?/sendMessage"] button[type="submit"]').click();
			await expect(page.getByText(text)).toBeVisible();
		} finally {
			await ctx.close();
		}
	});
});
