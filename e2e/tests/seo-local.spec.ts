import { test, expect } from '@playwright/test';

/**
 * Local-SEO regressions: the indexable public pages must carry the instance's city in the
 * metadata a crawler actually reads, and must have exactly one `<h1>`.
 *
 * Why raw `page.request.get()` for the metadata (same reasoning as `seo-canonical.spec.ts`):
 * a crawler reads the server response, not a hydrated DOM. Asserting on the raw HTML is the
 * only way to see what Google sees.
 *
 * Why this can't live in a unit test: `src/lib/texts.test.ts` pins the *strings*, but nothing
 * unit-level proves they reach the rendered `<title>`/`<meta>` or that the markup uses a
 * heading element. Note the trade-off — per `docs/testing-strategy.md` the e2e suite does not
 * run in CI, so this file is a local/manual gate, not an automated one.
 */

import { CITY } from '../fixtures/instance';

test.describe('local SEO — raw SSR metadata', () => {
	for (const path of ['/', '/search']) {
		test(`${path} names the city in its title and description`, async ({ page }) => {
			const res = await page.request.get(path);
			expect(res.ok()).toBeTruthy();
			const html = await res.text();

			const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
			expect(title, `${path} should render a <title>`).toBeDefined();
			expect(title).toContain(CITY);

			// Attribute-order-agnostic: `SeoHead.svelte` renders name-then-content today, but a
			// reordering there should not read as "meta description missing".
			const description = html.match(
				/<meta[^>]*\bname="description"[^>]*\bcontent="([^"]*)"/
			)?.[1];
			expect(description, `${path} should render a meta description`).toBeDefined();
			expect(description).toContain(CITY);
		});
	}
});

test.describe('local SEO — heading structure', () => {
	for (const path of ['/', '/search']) {
		test(`${path} has exactly one h1, naming the city`, async ({ page }) => {
			await page.goto(path);
			const h1 = page.getByRole('heading', { level: 1 });
			await expect(h1).toHaveCount(1);
			await expect(h1).toContainText(CITY);
		});
	}
});
