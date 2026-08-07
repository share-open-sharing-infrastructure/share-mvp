import { test, expect } from '@playwright/test';
import { NEWBIE_STORAGE_STATE } from '../fixtures/users';

/**
 * Onboarding — a fresh (hasOnboarded:false) user reaches the wizard and the client-side
 * stepper advances. The wizard is a purely client-side stepper (Welcome → How-it-works →
 * Survey → …), so this drives the first steps to confirm it renders, hydrates, and steps.
 * Runs as the newbie in the `multiuser` project.
 */

test.describe('onboarding', () => {
	test('an un-onboarded user can step through the wizard', async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: NEWBIE_STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			await page.goto('/onboarding');

			// Step 1 (welcome) → step 2. Retry the first click (dev hydration race); only
			// click while still on the welcome step (the start button is gone afterwards).
			const startBtn = page.getByRole('button', { name: /Kurzes Onboarding/ });
			const weiter = page.getByRole('button', { name: /Weiter/ });
			await expect(async () => {
				if (!(await weiter.isVisible())) await startBtn.click();
				await expect(weiter).toBeVisible({ timeout: 1000 });
			}).toPass({ timeout: 15_000 });

			// Step 2 (how it works) → step 3 (survey).
			await weiter.click();
			await expect(page.getByText('Eine ganz kurze Umfrage')).toBeVisible();
		} finally {
			await ctx.close();
		}
	});
});
