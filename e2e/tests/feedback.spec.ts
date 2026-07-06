import { test, expect } from '@playwright/test';

/**
 * Feedback — the home-page feedback modal creates a feedback record. Runs in the
 * `authenticated` project, so `page` is the owner ('/' requires auth). The modal opens
 * via client state, so retry the opener until it appears (dev hydration race).
 */

test.describe('feedback', () => {
	test('submitting feedback from the home page shows a success message', async ({ page }) => {
		await page.goto('/');

		const dialog = page.getByRole('dialog');
		await expect(async () => {
			await page.getByRole('button', { name: 'Feedback' }).first().click();
			await expect(dialog).toBeVisible({ timeout: 1000 });
		}).toPass({ timeout: 15_000 });

		await dialog.locator('textarea#feedbackMessage').fill('E2E Feedback: alles gut');
		await dialog.getByRole('button', { name: 'Feedback absenden' }).click();

		await expect(
			dialog.getByText('Feedback erfolgreich gesendet. Vielen Dank!')
		).toBeVisible();
	});
});
