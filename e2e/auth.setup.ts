import { test as setup, expect } from '@playwright/test';
import { OWNER, STORAGE_STATE } from './fixtures/users';

/**
 * Logs in as the seeded owner through the real login form and saves the authenticated
 * storage state, which the `authenticated` project reuses so each test starts logged in.
 */
setup('authenticate as owner', async ({ page }) => {
	await page.goto('/auth/login');
	await page.getByRole('textbox', { name: 'E-Mail' }).fill(OWNER.email);
	await page.getByRole('textbox', { name: 'Passwort' }).fill(OWNER.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();

	// A successful login redirects to the home page; the "Login" nav link then disappears.
	await expect(page.getByRole('link', { name: 'Login' })).toHaveCount(0);

	await page.context().storageState({ path: STORAGE_STATE });
});
