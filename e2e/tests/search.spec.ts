import { test, expect, type Browser } from '@playwright/test';
import { VIEWER_STORAGE_STATE, STRANGER_STORAGE_STATE } from '../fixtures/users';

/**
 * Search + trust visibility — the data-layer trust rule enforced through the real
 * `items_searchable` view. The owner's trustees-only "E2E Geheimwerkzeug" must be
 * visible to a trusted viewer but never to an untrusted user. Runs in the `multiuser`
 * project with a per-role context (search is server-rendered, so results are in the
 * initial HTML — no client fetch to wait on).
 */

const SECRET_ITEM = 'E2E Geheimwerkzeug'; // trustees-only, owned by e2e_owner_seed
const PUBLIC_ITEM = 'E2E Campingzelt'; // public, not touched by any other spec

async function searchAs(browser: Browser, storageState: string, query: string) {
	const ctx = await browser.newContext({ storageState });
	const page = await ctx.newPage();
	await page.goto('/search?q=' + encodeURIComponent(query));
	return { ctx, page };
}

test.describe('search & trust visibility', () => {
	test('a trusted user sees the owner’s trustees-only item', async ({ browser }) => {
		const { ctx, page } = await searchAs(browser, VIEWER_STORAGE_STATE, 'Geheimwerkzeug');
		try {
			await expect(page.getByRole('link', { name: SECRET_ITEM }).first()).toBeVisible();
		} finally {
			await ctx.close();
		}
	});

	test('an untrusted user does not see the trustees-only item', async ({ browser }) => {
		const { ctx, page } = await searchAs(browser, STRANGER_STORAGE_STATE, 'Geheimwerkzeug');
		try {
			await expect(page.getByRole('link', { name: SECRET_ITEM })).toHaveCount(0);
		} finally {
			await ctx.close();
		}
	});

	test('search renders a public item', async ({ browser }) => {
		const { ctx, page } = await searchAs(browser, VIEWER_STORAGE_STATE, PUBLIC_ITEM);
		try {
			await expect(page.getByRole('link', { name: PUBLIC_ITEM }).first()).toBeVisible();
		} finally {
			await ctx.close();
		}
	});
});
