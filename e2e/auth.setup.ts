import { test as setup, expect, type Page } from '@playwright/test';
import {
	OWNER,
	VIEWER,
	THIRD,
	STRANGER,
	NEWBIE,
	LOCKED,
	INSTITUTION,
	STORAGE_STATE,
	VIEWER_STORAGE_STATE,
	THIRD_STORAGE_STATE,
	STRANGER_STORAGE_STATE,
	NEWBIE_STORAGE_STATE,
	LOCKED_STORAGE_STATE,
	INSTITUTION_STORAGE_STATE,
} from './fixtures/users';

/**
 * Logs a seeded user in through the real login form and saves the authenticated
 * storage state, which the `authenticated` / `multiuser` projects reuse so their
 * tests start logged in. One setup test per role produces one storageState file.
 */
async function login(
	page: Page,
	email: string,
	password: string,
	statePath: string
) {
	await page.goto('/auth/login');
	await page.getByRole('textbox', { name: 'E-Mail' }).fill(email);
	await page.getByRole('textbox', { name: 'Passwort' }).fill(password);
	await page.getByRole('button', { name: 'Anmelden' }).click();

	// A successful login redirects to the home page; the "Login" nav link then disappears.
	await expect(page.getByRole('link', { name: 'Login' })).toHaveCount(0);

	await page.context().storageState({ path: statePath });
}

setup('authenticate as owner', async ({ page }) => {
	await login(page, OWNER.email, OWNER.password, STORAGE_STATE);
});

setup('authenticate as viewer', async ({ page }) => {
	await login(page, VIEWER.email, VIEWER.password, VIEWER_STORAGE_STATE);
});

setup('authenticate as third user', async ({ page }) => {
	await login(page, THIRD.email, THIRD.password, THIRD_STORAGE_STATE);
});

setup('authenticate as stranger', async ({ page }) => {
	await login(page, STRANGER.email, STRANGER.password, STRANGER_STORAGE_STATE);
});

setup('authenticate as newbie', async ({ page }) => {
	await login(page, NEWBIE.email, NEWBIE.password, NEWBIE_STORAGE_STATE);
});

setup('authenticate as locked user', async ({ page }) => {
	// A locked account can still authenticate; the consent gate then routes it to
	// /legal/locked (so the "Login" link is still gone — the assertion in login() holds).
	await login(page, LOCKED.email, LOCKED.password, LOCKED_STORAGE_STATE);
});

setup('authenticate as institution', async ({ page }) => {
	await login(page, INSTITUTION.email, INSTITUTION.password, INSTITUTION_STORAGE_STATE);
});
