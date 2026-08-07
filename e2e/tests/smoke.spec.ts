import { test, expect } from '@playwright/test';

/** Public pages render for logged-out visitors. */
test.describe('smoke (logged out)', () => {
	test('home page renders with the login/register entry points', async ({
		page,
	}) => {
		await page.goto('/');

		await expect(page).toHaveTitle(/AllerLeih/);
		// Stays a plain text assertion: the smoke test's job is "the page renders". The
		// tagline's heading level is pinned once, in `seo-local.spec.ts`.
		await expect(
			page.getByText('Leihe und teile kostenlos Dinge in Lüneburg')
		).toBeVisible();
		await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
		await expect(
			page.getByRole('link', { name: 'Registrieren' }).first()
		).toBeVisible();
		await expect(page.getByRole('link', { name: 'Suche' })).toBeVisible();
	});

	test('login page renders the sign-in form', async ({ page }) => {
		await page.goto('/auth/login');

		await expect(page).toHaveTitle(/Anmelden/);
		await expect(
			page.getByRole('heading', { name: 'Willkommen zurück!' })
		).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'E-Mail' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
	});
});
