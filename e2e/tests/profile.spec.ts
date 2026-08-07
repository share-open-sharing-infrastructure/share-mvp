import { test, expect, type Locator, type Page } from '@playwright/test';
import { STRANGER_STORAGE_STATE } from '../fixtures/users';

/**
 * Profile — saveProfile persists a changed bio, and a bio typed before hydration survives it
 * (regression for #558). Uses the stranger (owns nothing, not referenced by other tests'
 * assertions) so a concurrent run can't be disturbed. Only the bio is changed; the pre-filled
 * username is submitted unchanged. Runs in `multiuser`.
 *
 * Locators are page-level: the profile fields and the sticky "Speichern" save bar are not
 * all inside one <form> element, so scoping to the form would miss them.
 *
 * Self-parallelism: this file saves the *same* seed user (e2e_stranger_seed) in the first
 * test below, so `--repeat-each=N` spreads the copies across workers that would all write
 * (and then race to reload) that one row — "reload and find *my* bio" cannot hold by
 * construction under `fullyParallel`. Repeat runs of this file need `--workers=1`
 * (see e2e/README.md).
 *
 * The third test below (#607) also writes to the stranger, but through a disjoint
 * collection (`user_preferences`, not `users.bio`) — the bio save above never touches
 * emailNotifications/digestEmails, and vice versa — so it's safe to run in the same worker
 * pool as the bio tests without racing them. `--repeat-each` of that test specifically would
 * still need `--workers=1`, for the same reason as the bio test.
 */

/**
 * Waits until the page's client JS has hydrated and use:enhance is armed, using the push
 * toggle as the signal (see the first test below for the full reasoning): it's client-only
 * (PushNotificationSection resolves browser permission support in onMount, so it's absent
 * from the SSR HTML until then), so once it's visible the client JS has run.
 * EmailNotificationForm's autosave (onchange + use:enhance) needs the same JS pass, so this
 * gate covers it too.
 */
async function waitForHydration(page: Page): Promise<void> {
	await expect(
		page.getByRole('checkbox', { name: 'Push auf diesem Gerät' })
	).toBeVisible({ timeout: 15_000 });
}

/**
 * Idempotently drives a notification-prefs toggle to `checked`, waiting for the autosave
 * POST — and the settle of EmailNotificationForm's `savingPrefs` in-flight guard, surfaced
 * as the form's `aria-busy` — before returning. Needed because a second toggle click issued
 * while a previous save is still being processed (the guard clears only after use:enhance's
 * callback finishes its own `update()` round trip) is silently dropped, so callers must
 * serialize on the actual server round trip rather than the toggle's own (immediate,
 * client-side) checked state. A no-op (already at the target state) skips the wait entirely:
 * no click, no request.
 *
 * Clicks the wrapping `<label>`, not the checkbox `toggle` locator itself: Flowbite's
 * `<Toggle>` renders the real `<input>` `sr-only` (visually hidden) with a decorative `<span>`
 * for the switch graphic as its sibling, both inside one `<label>` (see
 * flowbite-svelte/forms/toggle/Toggle.svelte). Playwright's `.check()`/`.uncheck()` insist on
 * clicking the center of the `<input>` itself, and that pixel is covered by the `<span>` (a
 * real DOM element, not just a visual overlay), so Playwright's actionability check reports it
 * as "intercepting pointer events" and retries until the test times out — this is the exact
 * Label/Span-nesting trouble noted for this control. Clicking the label instead lands on real,
 * unobstructed markup and relies on the browser's native label→input click forwarding, exactly
 * like a real user or screen-reader user would.
 */
async function setNotifToggle(page: Page, toggle: Locator, checked: boolean): Promise<void> {
	if ((await toggle.isChecked()) === checked) return;
	const label = page.locator('label').filter({ has: toggle });
	const saved = page.waitForResponse(
		(res) => res.request().method() === 'POST' && res.url().includes('saveNotificationPrefs')
	);
	await label.click();
	await saved;
	if (checked) {
		await expect(toggle).toBeChecked();
	} else {
		await expect(toggle).not.toBeChecked();
	}
	await expect(
		page.locator('form[action="?/saveNotificationPrefs"]')
	).not.toHaveAttribute('aria-busy', 'true');
}

test.describe('profile', () => {
	test('saving a new bio persists it', async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: STRANGER_STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			const bio = `E2E Bio ${Date.now()}`;
			await page.goto('/user/profile');

			// Hydration gate: this control is client-rendered only (PushNotificationSection
			// resolves the browser permission in onMount — the section is absent from the SSR
			// HTML until then, since it's gated on `pushSupported`, false until onMount runs),
			// so once it's visible the page's JS has run — Svelte's initial value pass is done
			// and use:enhance is armed. Filling earlier is exactly #558; a fixed wait or
			// `networkidle` would be flaky against the dev server.
			await expect(
				page.getByRole('checkbox', { name: 'Push auf diesem Gerät' })
			).toBeVisible({ timeout: 15_000 });

			const bioField = page.locator('textarea[name="bio"]');
			await bioField.fill(bio);
			await expect(bioField).toHaveValue(bio);

			await page.getByRole('button', { name: 'Speichern' }).first().click();
			// Wait for the save to complete (success toast) before navigating away.
			await expect(
				page.getByText('Daten wurden erfolgreich aktualisiert.')
			).toBeVisible({ timeout: 10_000 });

			// Reload and confirm the value stuck.
			await page.goto('/user/profile');
			await expect(page.locator('textarea[name="bio"]')).toHaveValue(bio);
		} finally {
			await ctx.close();
		}
	});

	test('text typed before hydration survives it (#558 regression)', async ({ browser }) => {
		// Regression for #558: text typed before the page hydrates must survive hydration.
		// `waitUntil: 'commit'` returns as soon as the SSR HTML starts arriving, so the fill
		// lands in the (large, in dev) window before the client modules run. Before the fix,
		// Svelte's first `set_value` pass reset the textarea to the loaded value ('' for the
		// seeded user) and the following save persisted an empty bio behind a success toast.
		// If hydration wins the race the test is trivially green — it can never be falsely red.
		const ctx = await browser.newContext({ storageState: STRANGER_STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			const bio = `E2E Pre-Hydration Bio ${Date.now()}`;
			await page.goto('/user/profile', { waitUntil: 'commit' });

			const bioField = page.locator('textarea[name="bio"]');
			await bioField.fill(bio);
			await expect(bioField).toHaveValue(bio);

			// No save here: this test performs no DB write, so it can't collide with the
			// save-and-reload test above under `fullyParallel`.
		} finally {
			await ctx.close();
		}
	});

	test('turning off email notifications preserves the digest preference (#607 regression)', async ({
		browser,
	}) => {
		// #607 B1: the digest toggle used to be natively `disabled` while the master switch
		// was off. A `disabled` <input> is dropped from FormData entirely (HTML forms rule),
		// so the action read `digestEmails` back as `false` and silently persisted it — even
		// though the user never touched that toggle, only the master switch. The fix moved
		// the digest toggle's `name` onto an always-present hidden input (so FormData always
		// reflects `digestEnabled`) and swapped the visible toggle's `disabled` for
		// `aria-disabled` (a deliberate a11y call from the review: it stays focusable for
		// keyboard/screen-reader users while inert). This is form/DOM semantics a Vitest
		// action test can't exercise, so this spec drives the real browser path end to end —
		// a future component refactor or Flowbite update can't silently reintroduce either bug.
		const ctx = await browser.newContext({ storageState: STRANGER_STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			await page.goto('/user/profile#benachrichtigungen');
			await waitForHydration(page);

			const masterToggle = page.getByRole('checkbox', {
				name: 'E-Mail-Benachrichtigungen',
			});
			const digestToggle = page.getByRole('checkbox', {
				name: 'Wochen-Rückblick per E-Mail',
			});

			// Known starting point regardless of state left over from an earlier run: both on.
			await setNotifToggle(page, masterToggle, true);
			await setNotifToggle(page, digestToggle, true);

			// Act: flip ONLY the master switch off.
			await setNotifToggle(page, masterToggle, false);

			// Reload so the assertion below reads back what was actually persisted, not just
			// the optimistic client-side toggle state.
			await page.reload();
			await expect(masterToggle).not.toBeChecked();
			// The regression core: the digest preference must survive untouched.
			await expect(digestToggle).toBeChecked();

			// a11y (#607 review decision): inert while the master is off, but reachable —
			// aria-disabled, never the native `disabled` attribute (whose mere presence, not
			// its value, is what drops a control from FormData).
			await expect(digestToggle).toHaveAttribute('aria-disabled', 'true');
			await expect(digestToggle).not.toHaveAttribute('disabled');
			await digestToggle.focus();
			await expect(digestToggle).toBeFocused();

			// The digest toggle is also an independent opt-out, not just a passive follower of
			// the master switch: re-enable the master, then flip digest alone and confirm the
			// master is untouched.
			await waitForHydration(page); // the reload above dropped hydration; re-arm before clicking
			await setNotifToggle(page, masterToggle, true);
			await setNotifToggle(page, digestToggle, false);

			await page.reload();
			await expect(masterToggle).toBeChecked();
			await expect(digestToggle).not.toBeChecked();

			// Cleanup: restore the starting state so a later run (or a human) finds both on.
			await waitForHydration(page);
			await setNotifToggle(page, digestToggle, true);
		} finally {
			await ctx.close();
		}
	});
});
