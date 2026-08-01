import { test, expect } from '@playwright/test';
import { STRANGER_STORAGE_STATE } from '../fixtures/users';
import { expectFieldsSurvivePreHydration } from '../fixtures/preHydration';

/**
 * Profile — saveProfile persists a changed bio, and a bio typed before hydration survives it
 * (regression for #558), as does a city typed into AddressInput (the same bug class, #613).
 * Uses the stranger (owns nothing, not referenced by other tests'
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
 */

test.describe('profile', () => {
	test('saving a new bio persists it', async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: STRANGER_STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			const bio = `E2E Bio ${Date.now()}`;
			await page.goto('/user/profile');

			// Hydration gate: this control is client-rendered only (NotificationSettings
			// resolves the browser permission in onMount — the section is absent from the SSR
			// HTML until then, since it's gated on `pushSupported`/`emailPrefsLoaded`, both
			// false until onMount runs), so once it's visible the page's JS has run — Svelte's
			// initial value pass is done and use:enhance is armed. Filling earlier is exactly
			// #558; a fixed wait or `networkidle` would be flaky against the dev server.
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
		// Before the fix, Svelte's first `set_value` pass reset the textarea to the loaded value
		// ('' for the seeded user) and the following save persisted an empty bio behind a success
		// toast — which is what made this worth a browser test at all.
		const ctx = await browser.newContext({ storageState: STRANGER_STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			await expectFieldsSurvivePreHydration(page, '/user/profile', {
				'textarea[name="bio"]': `E2E Pre-Hydration Bio ${Date.now()}`,
			});
		} finally {
			await ctx.close();
		}
	});

	test('a city typed before hydration survives it (#613 regression)', async ({ browser }) => {
		// Same bug class as #558, different component: AddressInput's city field is SSR-rendered
		// on /user/profile and was fed a one-way `value={cityText}`. Every seed user has an empty
		// city (scripts/seed/lib.js sets none), so the assertion is sharp — anything the field
		// holds afterwards can only have come from the fill.
		const ctx = await browser.newContext({ storageState: STRANGER_STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			await expectFieldsSurvivePreHydration(page, '/user/profile', {
				'input[name="city"]': 'E2E Teststraße 1',
			});
		} finally {
			await ctx.close();
		}
	});
});
