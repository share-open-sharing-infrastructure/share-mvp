import { defineConfig } from '@playwright/test';
import { STORAGE_STATE } from './e2e/fixtures/users';

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
				'tests/search-focus.spec.ts',
				'tests/search-focus.mobile.spec.ts',
			],
		},
		{
			name: 'authenticated',
			use: { browserName: 'chromium', storageState: STORAGE_STATE },
			dependencies: ['setup'],
			testMatch: ['tests/authenticated.spec.ts'],
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
		},
	},
});
