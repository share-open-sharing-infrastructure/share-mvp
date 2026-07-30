import { test, expect } from '@playwright/test';

/**
 * Regression test for issue #473 (round 4): `SeoHead`'s canonical link and the invite page's
 * `og:url` must be a clean absolute URL in the *raw server-rendered* HTML, not just after the
 * client re-derives it on hydration.
 *
 * Why this couldn't be caught any other way: `svelte.config.js` has no `paths` block, so
 * SvelteKit's default `paths.relative: true` applies, and `resolve()` (`$app/paths`) returns a
 * *page-relative* path during SSR (`'./'` for `/`, `'../misc/imprint'` for a nested route).
 * `instanceUrl(resolve(...))` therefore built a malformed absolute URL
 * (`https://allerleih.org../misc/imprint`) in the SSR response — but a normal Playwright
 * `page.goto()` (or any interactive browser session) hides it, because the client recomputes a
 * correct-looking value after hydration. Unit tests can't see it either: nothing exercises real
 * SSR `resolve()` output flowing into `instanceUrl()`, and `SeoHead.svelte` has no unit test.
 *
 * `page.request.get()` fetches the raw HTML the way a crawler (or `curl`) would — no browser
 * rendering, so no hydration to paper over a wrong SSR value.
 */

// The e2e dev server (playwright.config.ts webServer) runs with no PUBLIC_SITE_ORIGIN override,
// so `$lib/instance`'s DEFAULT_ORIGIN applies. Not imported from `src/lib/instance.ts`: e2e specs
// run outside the Vite/SvelteKit `$lib` alias resolution the unit tests get.
const ORIGIN = 'https://allerleih.org';

test.describe('canonical / og:url — raw SSR HTML (issue #473 round 4 regression)', () => {
	test('root route has a clean canonical link', async ({ page }) => {
		const res = await page.request.get('/');
		expect(res.ok()).toBeTruthy();
		const html = await res.text();
		expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/"/>`);
	});

	test('a nested route has a clean canonical link', async ({ page }) => {
		const res = await page.request.get('/misc/imprint');
		expect(res.ok()).toBeTruthy();
		const html = await res.text();
		expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/misc/imprint"/>`);
	});

	test('the invite page has a clean og:url', async ({ page }) => {
		// Any slug renders the page (load() falls back to inviterName: null for an unknown one),
		// so no seeded invite is needed here.
		const res = await page.request.get('/invite/testslug123');
		expect(res.ok()).toBeTruthy();
		const html = await res.text();
		expect(html).toContain(`<meta property="og:url" content="${ORIGIN}/invite/testslug123"/>`);
	});
});
