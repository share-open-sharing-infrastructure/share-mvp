import { test, expect } from '@playwright/test';
import { OWNER } from '../fixtures/users';

/** The login form itself — starts logged out (no stored auth state in this project). */
test.describe('login', () => {
	test('valid credentials log the user in', async ({ page }) => {
		await page.goto('/auth/login');
		await page.getByRole('textbox', { name: 'E-Mail' }).fill(OWNER.email);
		await page.getByRole('textbox', { name: 'Passwort' }).fill(OWNER.password);
		await page.getByRole('button', { name: 'Anmelden' }).click();

		// Redirected away from the login form; the "Login" nav link is gone once authenticated.
		await expect(page).not.toHaveURL(/\/auth\/login/);
		await expect(page.getByRole('link', { name: 'Login' })).toHaveCount(0);
	});

	test('invalid credentials keep the user on the login page', async ({
		page,
	}) => {
		await page.goto('/auth/login');
		await page.getByRole('textbox', { name: 'E-Mail' }).fill(OWNER.email);
		await page
			.getByRole('textbox', { name: 'Passwort' })
			.fill('definitely-wrong-password');
		await page.getByRole('button', { name: 'Anmelden' }).click();

		await expect(page).toHaveURL(/\/auth\/login/);
		await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
	});
});
