import { defineConfig } from '@playwright/test';
import { STORAGE_STATE } from './e2e/fixtures/users';
import { CITY, ORIGIN, SURVEY_URL, NEWSLETTER_FORM_URL } from './e2e/fixtures/instance';

/**
 * End-to-end tests (see e2e/README.md).
 *
 * Requires a running PocketBase (real backend schema). Configure via env:
 *   PB_URL                 PocketBase base URL       (default http://127.0.0.1:8091)
 *   PB_SUPERUSER_EMAIL     superuser for seeding     (required — global-setup seeds the `e2e` scenario)
 *   PB_SUPERUSER_PASSWORD  superuser password        (required)
 *   E2E_BASE_URL           app base URL              (default http://127.0.0.1:5173)
 *
 * The dev server is started automatically (webServer) and pointed at PB_URL.
 */
const HOST = '127.0.0.1';
const PORT = 5173;
const baseURL = process.env.E2E_BASE_URL ?? `http://${HOST}:${PORT}`;

const rawPbUrl = process.env.PB_URL ?? 'http://127.0.0.1:8091';
// itemImageUrl builds `${PUBLIC_PB_URL}api/files/…`, so the trailing slash matters.
const pbUrl = rawPbUrl.endsWith('/') ? rawPbUrl : `${rawPbUrl}/`;

export default defineConfig({
	testDir: './e2e',
	globalSetup: './e2e/global-setup.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [['list'], ['html', { open: 'never' }]],

	use: {
		baseURL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},

	projects: [
		{ name: 'setup', testMatch: 'auth.setup.ts' },
		{
			name: 'public',
			use: { browserName: 'chromium' },
			testMatch: [
				'tests/smoke.spec.ts',
				'tests/auth.spec.ts',
				'tests/email-case-insensitive.spec.ts',
				'tests/misc.spec.ts',
				'tests/search-focus.spec.ts',
				'tests/search-focus.mobile.spec.ts',
				'tests/seo-canonical.spec.ts',
				'tests/seo-local.spec.ts',
			],
		},
		{
			name: 'authenticated',
			use: { browserName: 'chromium', storageState: STORAGE_STATE },
			dependencies: ['setup'],
			testMatch: [
				'tests/authenticated.spec.ts',
				'tests/item-upload.spec.ts',
				'tests/trust.spec.ts',
				'tests/feedback.spec.ts',
				'tests/toast-over-modal.spec.ts',
				'tests/user-items-search.spec.ts',
			],
		},
		{
			// Cross-actor flows (lending, group join) open their own per-role contexts,
			// so no project-level storageState — just ensure the states exist (setup).
			name: 'multiuser',
			use: { browserName: 'chromium' },
			dependencies: ['setup'],
			testMatch: [
				'tests/lending.spec.ts',
				'tests/conversation-read-on-open.spec.ts',
				'tests/groups.spec.ts',
				'tests/search.spec.ts',
				'tests/messages.spec.ts',
				'tests/notifications.spec.ts',
				'tests/profile.spec.ts',
				'tests/onboarding.spec.ts',
				'tests/account.spec.ts',
				'tests/external-fallbacks.spec.ts',
				'tests/legal.spec.ts',
				'tests/import.spec.ts',
			],
		},
	],

	webServer: {
		command: `npm run dev -- --host ${HOST} --port ${PORT}`,
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			PUBLIC_PB_URL: pbUrl,
			DEV_DISABLE_MKCERT: 'true',
			PUBLIC_INSTANCE_CITY: CITY,
			PUBLIC_SITE_ORIGIN: ORIGIN,
			// Class D (share-mvp#631) — dummy hosts (see e2e/fixtures/instance.ts), pinned so the
			// onboarding survey step + newsletter opt-in exist for the specs that need them.
			PUBLIC_ONBOARDING_SURVEY_URL: SURVEY_URL,
			PUBLIC_NEWSLETTER_FORM_URL: NEWSLETTER_FORM_URL,
		},
	},
});
