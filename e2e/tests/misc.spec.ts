import { test, expect } from '@playwright/test';

/**
 * Public content pages + sitemap — logged-out smoke (runs in the `public` project).
 * These routes are in the auth hook's unprotected-prefix list, so a guest reaches them
 * without a redirect to /auth/login.
 */

const PUBLIC_PAGES = ['/misc/about', '/misc/contact', '/misc/guide', '/misc/imprint'];

test.describe('public pages (smoke)', () => {
	for (const path of PUBLIC_PAGES) {
		test(`${path} renders for logged-out visitors`, async ({ page }) => {
			await page.goto(path);
			// Not redirected to login, and real content rendered.
			await expect(page).toHaveURL(new RegExp(path + '$'));
			await expect(page.getByRole('heading').first()).toBeVisible();
		});
	}

	test('sitemap.xml lists items', async ({ page }) => {
		const res = await page.request.get('/sitemap.xml');
		expect(res.ok()).toBeTruthy();
		const body = await res.text();
		expect(body).toContain('<urlset');
		expect(body).toContain('/items/');
	});
});
