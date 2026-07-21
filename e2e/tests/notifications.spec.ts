import { test, expect } from '@playwright/test';
import { STRANGER_STORAGE_STATE } from '../fixtures/users';

/**
 * Notifications list — render + read-toggle. Uses the stranger's single seeded
 * notification (see e2e.js); nothing else notifies the stranger, so the list is
 * deterministic under fullyParallel. Runs in the `multiuser` project.
 */

const BODY = 'e2e_owner_seed vertraut dir jetzt';

test.describe('notifications', () => {
	test('the list shows a notification and toggles its read state', async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: STRANGER_STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			await page.goto('/notifications');
			const item = page.getByRole('listitem').filter({ hasText: BODY });
			await expect(item).toBeVisible();

			// Seeded unread → mark read; the toggle's label flips.
			await item.getByRole('button', { name: 'Als gelesen markieren' }).click();
			await expect(
				item.getByRole('button', { name: 'Als ungelesen markieren' })
			).toBeVisible();
		} finally {
			await ctx.close();
		}
	});
});
