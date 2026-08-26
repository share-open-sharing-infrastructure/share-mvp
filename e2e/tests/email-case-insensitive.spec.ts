import { test, expect, type Page } from '@playwright/test';
import { SEED_PASSWORD } from '../fixtures/users';

/**
 * Case-insensitive email — regression guard for #557.
 *
 * PocketBase matched `users.email` case-sensitively and did not normalize on save,
 * so an account registered with a mixed-case address (`Julika7@…`) became
 * unreachable by the lowercase login/reset the user later typed. The frontend now
 * normalizes (trim + lowercase) at every email boundary. These tests register with
 * a deliberately mixed-case address and prove the lowercase variant reaches the
 * same account.
 *
 * Runs logged-out in the `public` project. Each test registers its own fresh,
 * unique account, so it never touches the seeded fixtures and is parallel-safe.
 * No SMTP dependency: the reset guard only asserts the action redirects cleanly
 * (the silent 204 / anti-enumeration behaviour is intentional and unasserted).
 */

type FreshUser = {
	/** As typed at registration — deliberately mixed-case (the #557 repro). */
	emailMixed: string;
	/** What the user types later, on a different device: the lowercase variant. */
	emailLower: string;
	username: string;
	password: string;
};

/**
 * Register a brand-new account through the real form with a mixed-case email.
 * Leaves the page authenticated (redirected off the register form). Reuses the
 * same role/label selectors as auth.spec.ts; the newsletter opt-in is unchecked
 * so registration makes no external (Keila) call. The checkbox itself only renders
 * when `instance.newsletterFormUrl` is set (share-mvp#631) — relies on
 * `playwright.config.ts` pinning `e2e/fixtures/instance.ts`'s dummy
 * `NEWSLETTER_FORM_URL` into `webServer.env` for the whole e2e run.
 */
async function registerFreshUser(page: Page): Promise<FreshUser> {
	const unique = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
	const emailMixed = `Julika7.${unique}@Example.COM`;
	const user: FreshUser = {
		emailMixed,
		emailLower: emailMixed.toLowerCase(),
		username: `e2e557u${unique}`,
		password: SEED_PASSWORD,
	};

	await page.goto('/auth/register');
	// Register has two textboxes whose accessible names both contain "E-Mail" (the
	// username field's hint text mentions logging in with the E-Mail address), so the
	// role-name match is ambiguous here. Target the input by its stable `name`
	// attribute instead. (Login/reset each have a single email field, so those stay
	// on the role selector shared with auth.spec.ts.)
	await page.locator('input[name="email"]').fill(user.emailMixed);
	await page.getByRole('textbox', { name: 'Nutzername' }).fill(user.username);
	await page.getByRole('textbox', { name: 'Passwort' }).fill(user.password);
	await page.getByRole('checkbox', { name: /stimme beiden zu/ }).check();
	await page.getByRole('checkbox', { name: /Newsletter erhalten/ }).uncheck();
	await page.getByRole('button', { name: 'Registrieren' }).click();

	// The register action redirects to /onboarding only on success (a failed create
	// returns a fail() and stays on /auth/register), so this URL is the precise
	// "registered + session started" signal. Note: the layout hides the NavBar on
	// /onboarding, which is why logout() below first navigates to a nav-bearing route.
	await expect(page).toHaveURL(/\/onboarding/);

	return user;
}

/**
 * Drop the session by clearing the browser context's cookies — the deterministic,
 * idiomatic way to reach a fresh unauthenticated session. This sidesteps the nav's
 * logout UI entirely (Flowbite dropdown hydration is unrelated to #557 and flaky in
 * this harness). The auth token is a normal `pb_auth` HTTP cookie in this same context,
 * so `context.clearCookies()` (no filter → all cookies) removes it.
 *
 * #557 is about a fresh session logging in with the lowercase variant — not about the
 * logout UI — so a cookie-cleared session is the semantically correct precondition.
 */
async function logout(page: Page): Promise<void> {
	await page.context().clearCookies();
	// Confirm the session is gone: /auth/login renders its form only when
	// unauthenticated (it redirects to '/' otherwise).
	await page.goto('/auth/login');
	await expect(page.getByRole('textbox', { name: 'E-Mail' })).toBeVisible();
}

test.describe('email case-insensitivity (#557)', () => {
	// The nav collapses to a hamburger below Tailwind's xl (1280px); pin a comfortably
	// wide viewport so the profile dropdown trigger is always directly clickable.
	test.use({ viewport: { width: 1440, height: 900 } });

	test('login with the lowercase variant of a mixed-case registration succeeds', async ({
		page,
	}) => {
		const user = await registerFreshUser(page);
		await logout(page);

		// The core #557 repro: typed lowercase, account stored via a mixed-case form.
		await page.getByRole('textbox', { name: 'E-Mail' }).fill(user.emailLower);
		await page.getByRole('textbox', { name: 'Passwort' }).fill(user.password);
		await page.getByRole('button', { name: 'Anmelden' }).click();

		// Login redirected off the form...
		await expect(page).not.toHaveURL(/\/auth\/login/);
		// ...and the session is authenticated: on a nav-bearing route the profile
		// dropdown trigger (this run's username) renders only when logged in, while the
		// logged-out "Login" link is absent. Explicit goto('/') keeps this independent
		// of the login landing route. This is the #557 core assertion: the LOWERCASE
		// variant of the mixed-case registration authenticates.
		await page.goto('/');
		await expect(page.locator('button', { hasText: user.username })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Login' })).toHaveCount(0);
	});

	test('password reset with the lowercase variant redirects cleanly', async ({ page }) => {
		const user = await registerFreshUser(page);
		await logout(page);

		await page.goto('/auth/reset');
		await page.getByRole('textbox', { name: 'E-Mail' }).fill(user.emailLower);
		await page.getByRole('button', { name: 'Setze mein Passwort zurück!' }).click();

		// The reset action found the account and redirected to login (no 500 error
		// alert). We do NOT assert mail delivery — the silent 204 is intentional.
		await expect(page).toHaveURL(/\/auth\/login/);
	});
});
