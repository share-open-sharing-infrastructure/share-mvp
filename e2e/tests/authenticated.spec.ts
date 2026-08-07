import { test, expect } from '@playwright/test';
import { OWNER } from '../fixtures/users';

/** These run with the storage state saved by auth.setup.ts — already logged in. */
test.describe('authenticated', () => {
	test('home shows the authenticated navigation', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('link', { name: 'Login' })).toHaveCount(0);
		await expect(page.getByText(OWNER.username).first()).toBeVisible();
	});

	test('the profile page is reachable without a redirect to login', async ({
		page,
	}) => {
		await page.goto('/user/profile');

		await expect(page).toHaveURL(/\/user\/profile/);
		await expect(page).not.toHaveURL(/\/auth\/login/);
	});

	test('the own-items page is reachable without a redirect to login', async ({
		page,
	}) => {
		await page.goto('/user/items');

		await expect(page).toHaveURL(/\/user\/items/);
		await expect(page).not.toHaveURL(/\/auth\/login/);
	});
});
