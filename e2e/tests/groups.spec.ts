import { test, expect } from '@playwright/test';
import { STORAGE_STATE, THIRD_STORAGE_STATE, VIEWER } from '../fixtures/users';
import { expectFieldsSurvivePreHydration } from '../fixtures/preHydration';

/**
 * Groups — the owner-managed lifecycle and the invite-token join.
 *
 * Runs in the `multiuser` project and opens its own per-role contexts:
 *  - the management test drives everything from a fresh group it creates itself, so it
 *    needs no pre-seeded group id;
 *  - the join test uses the seeded private group's fixed invite token (see e2e.js).
 */

// Kept in sync with scripts/seed/scenarios/e2e.js (backend requires exactly 24 chars).
const INVITE_TOKEN = 'e2ejointoken000000000000';
const PRIVATE_GROUP = 'E2E Werkzeuggruppe';

/**
 * In dev a route compiles on first hit, so an early click/fill can land before Svelte
 * hydrates the handler (or hydration resets a too-early input). Retry the interaction
 * until the expected result appears.
 */
async function untilReady(action: () => Promise<void>, expectation: () => Promise<void>) {
	await expect(async () => {
		await action();
		await expectation();
	}).toPass({ timeout: 15_000 });
}

test.describe('groups', () => {
	test('owner creates a group, manages a member, mints an invite, deletes it', async ({
		browser,
	}) => {
		const ctx = await browser.newContext({ storageState: STORAGE_STATE });
		const page = await ctx.newPage();
		page.on('dialog', (d) => d.accept()); // leave/remove/delete use confirm()
		try {
			const groupName = `E2E Gruppe ${Date.now()}`;
			const dialog = page.getByRole('dialog');

			// Create — retry the opener until the modal actually opens.
			await page.goto('/user/groups');
			await untilReady(
				() => page.getByRole('button', { name: 'Gruppe erstellen' }).first().click(),
				() => expect(dialog).toBeVisible({ timeout: 1000 })
			);
			await dialog.getByPlaceholder('z. B. Nachbarschaft Nord').fill(groupName);
			await dialog.getByRole('button', { name: 'Gruppe erstellen' }).click();
			await expect(dialog).toBeHidden();

			// The new group shows in the owned list; open it and grab its id.
			const card = page.getByRole('link', { name: groupName });
			await expect(card).toBeVisible();
			await card.click();
			await expect(page).toHaveURL(/\/user\/groups\/[^/]+$/);
			const groupId = page.url().split('/').pop();

			// Members: add the viewer (retry the search until the candidate appears), then remove.
			await page.goto(`/user/groups/${groupId}/members`);
			const addBtn = page.getByRole('button', { name: `@${VIEWER.username}` });
			await untilReady(
				() => page.getByPlaceholder('Nutzername suchen…').fill(VIEWER.username),
				() => expect(addBtn).toBeVisible({ timeout: 1000 })
			);
			await addBtn.click();
			const memberRow = page
				.getByRole('listitem')
				.filter({ hasText: VIEWER.username });
			await expect(memberRow).toBeVisible();
			await memberRow.getByRole('button', { name: 'Entfernen' }).click();
			await expect(memberRow).toHaveCount(0);

			// Settings: mint an invite link (progressive-enhanced form → the revoke control appears).
			await page.goto(`/user/groups/${groupId}/settings`);
			await page.getByRole('button', { name: 'Einladungslink erstellen' }).click();
			await expect(page.getByRole('button', { name: 'Link widerrufen' })).toBeVisible();

			// Delete → back to the list, group gone.
			await page.getByRole('button', { name: 'Gruppe löschen' }).click();
			await expect(page).toHaveURL(/\/user\/groups$/);
			await expect(page.getByRole('link', { name: groupName })).toHaveCount(0);
		} finally {
			await ctx.close();
		}
	});

	test('group name and description typed before hydration survive it (#613 regression)', async ({
		browser,
	}) => {
		const ctx = await browser.newContext({ storageState: STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			// The seeded group's id isn't stable across seed runs, so look it up by name
			// instead of hard-coding it.
			await page.goto('/user/groups');
			const card = page.getByRole('link', { name: PRIVATE_GROUP });
			await expect(card).toBeVisible();
			const groupId = (await card.getAttribute('href'))?.split('/').pop();
			expect(groupId).toBeTruthy();

			// Regression for #613: both fields passed a one-way `value=` into Flowbite's
			// Input/Textarea, which the root layout's afterNavigate invalidate then clobbered
			// right after hydration (docs/best-practices.md → "Editable fields: seed-once +
			// bind:, never one-way value="). The helper never saves, so this cannot rename the
			// shared seed group out from under the join test below under `fullyParallel`.
			await expectFieldsSurvivePreHydration(page, `/user/groups/${groupId}/settings`, {
				'input[name="name"]': `E2E Vor-Hydration ${Date.now()}`,
				'textarea[name="description"]': `E2E Beschreibung ${Date.now()}`,
			});
		} finally {
			await ctx.close();
		}
	});

	test('a logged-in user joins a private group via its invite token', async ({
		browser,
	}) => {
		const ctx = await browser.newContext({ storageState: THIRD_STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			await page.goto(`/groups/join/${INVITE_TOKEN}`);
			await expect(page.getByText(new RegExp(PRIVATE_GROUP))).toBeVisible();
			await page.getByRole('button', { name: 'Gruppe beitreten' }).click();
			await expect(
				page.getByText(new RegExp(`Gruppe .${PRIVATE_GROUP}. beigetreten`))
			).toBeVisible();
		} finally {
			await ctx.close();
		}
	});
});
