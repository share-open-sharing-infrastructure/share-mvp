import { test, expect } from '@playwright/test';
import { THIRD } from '../fixtures/users';

/**
 * Trust graph via /social — validates the backend `trusts` join collection end-to-end.
 * Runs in the `authenticated` project, so `page` is logged in as the owner
 * (e2e_owner_seed). The seed leaves e2e_third_seed untrusted, so we can grant then
 * revoke trust from a clean slate.
 */

test.describe('trust', () => {
	test('owner grants then revokes trust to a user via /social', async ({ page }) => {
		await page.goto('/social');

		// Type the third user's name and open the "add someone new" dropdown. Retry the
		// fill until the toggle appears — in dev a route compiles on first hit and hydration
		// can reset an input typed too early.
		const toggle = page.getByRole('button', { name: /Noch nicht im Netzwerk/ });
		await expect(async () => {
			await page.getByPlaceholder('Netzwerk durchsuchen...').fill(THIRD.username);
			await expect(toggle).toBeVisible({ timeout: 1000 });
		}).toPass({ timeout: 15_000 });
		await toggle.click();

		const addForm = page.locator('form[action="?/addTrustee"]');
		await expect(addForm).toBeVisible();
		await addForm.getByRole('button').click();

		// Third now appears in the trust network with the "you trust them" box checked.
		const row = page.getByRole('row', { name: new RegExp(THIRD.username) });
		await expect(row).toBeVisible();
		await expect(row.getByRole('checkbox')).toBeChecked();

		// Revoke: unchecking submits removeTrustee; third then leaves the network entirely.
		await row.getByRole('checkbox').uncheck();
		await expect(
			page.getByRole('row', { name: new RegExp(THIRD.username) })
		).toHaveCount(0);
	});
});
