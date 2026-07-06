import { test, expect } from '@playwright/test';
import { STRANGER_STORAGE_STATE } from '../fixtures/users';

/**
 * Profile — saveProfile persists a changed bio. Uses the stranger (owns nothing, not
 * referenced by other tests' assertions) so a concurrent run can't be disturbed. Only the
 * bio is changed; the pre-filled username is submitted unchanged. Runs in `multiuser`.
 *
 * Locators are page-level: the profile fields and the sticky "Speichern" save bar are not
 * all inside one <form> element, so scoping to the form would miss them.
 */

test.describe('profile', () => {
	test('saving a new bio persists it', async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: STRANGER_STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			const bio = `E2E Bio ${Date.now()}`;
			await page.goto('/user/profile');

			// Retry the fill until it sticks — under load, hydration can reset a too-early
			// input. Once it holds, the form is hydrated, so Speichern runs through use:enhance
			// (a fetch, not a native navigation that would race the reload below).
			const bioField = page.locator('textarea[name="bio"]');
			await expect(async () => {
				await bioField.fill(bio);
				await expect(bioField).toHaveValue(bio, { timeout: 500 });
			}).toPass({ timeout: 15_000 });

			await page.getByRole('button', { name: 'Speichern' }).first().click();
			// Wait for the save to complete (success toast) before navigating away.
			await expect(
				page.getByText('Daten wurden erfolgreich aktualisiert.')
			).toBeVisible({ timeout: 10_000 });

			// Reload and confirm the value stuck.
			await page.goto('/user/profile');
			await expect(page.locator('textarea[name="bio"]')).toHaveValue(bio);
		} finally {
			await ctx.close();
		}
	});
});
