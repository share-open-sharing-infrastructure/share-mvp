import {
	test,
	expect,
	type BrowserContext,
	type Page,
} from '@playwright/test';
import { STORAGE_STATE, VIEWER_STORAGE_STATE } from '../fixtures/users';

/**
 * The lending lifecycle — the core end-to-end flow — driven across two logged-in
 * sessions at once: the borrower (viewer) requests the owner's public item, then the
 * two parties walk it through accept → handover → return-report → return-confirm.
 *
 * The `e2e` seed is re-created fresh before every run (global-setup), so there is no
 * prior conversation for this owner/viewer/item pair: requesting yields a fresh
 * `pending` conversation. Both actors open the SAME conversation URL and re-navigate
 * to observe the other party's state changes (rather than relying on realtime).
 */

const ITEM = 'E2E Bohrmaschine';

test.describe('lending lifecycle', () => {
	let ownerCtx: BrowserContext;
	let viewerCtx: BrowserContext;
	let owner: Page;
	let viewer: Page;

	test.beforeEach(async ({ browser }) => {
		ownerCtx = await browser.newContext({ storageState: STORAGE_STATE });
		viewerCtx = await browser.newContext({ storageState: VIEWER_STORAGE_STATE });
		owner = await ownerCtx.newPage();
		viewer = await viewerCtx.newPage();
	});

	test.afterEach(async () => {
		await ownerCtx.close();
		await viewerCtx.close();
	});

	test('request → accept → handover → return → complete', async () => {
		// Borrower finds the owner's public item in search and requests it. Query by name
		// so the result is on the first page regardless of how many other items exist.
		await viewer.goto('/search?q=' + encodeURIComponent(ITEM));
		await viewer.getByRole('link', { name: ITEM }).first().click();
		await expect(viewer).toHaveURL(/\/items\/[^/]+$/);
		await viewer.getByRole('button', { name: 'Anfragen' }).click();

		// Requesting lands the borrower in the fresh conversation (pending).
		await expect(viewer).toHaveURL(/\/conversations\/[^/]+$/);
		const conversationUrl = viewer.url();

		// Owner opens the same conversation, sees the pending request, and accepts it.
		await owner.goto(conversationUrl);
		await owner.getByRole('button', { name: 'Annehmen' }).click();

		// After accepting, the owner confirms the handover → active loan.
		const handover = owner.getByRole('button', { name: 'Übergabe bestätigen' });
		await expect(handover).toBeVisible();
		await handover.click();
		await expect(handover).toBeHidden();

		// Borrower reports the return.
		await viewer.goto(conversationUrl);
		const reportReturn = viewer.getByRole('button', { name: 'Rückgabe melden' });
		await expect(reportReturn).toBeVisible();
		await reportReturn.click();

		// Owner confirms the return → completed.
		await owner.goto(conversationUrl);
		const confirmReturn = owner.getByRole('button', {
			name: 'Rückgabe bestätigen',
		});
		await expect(confirmReturn).toBeVisible();
		await confirmReturn.click();

		// Completed: the closing description shows and no action buttons remain.
		await expect(owner.getByText('Die Ausleihe ist abgeschlossen.')).toBeVisible();
		await expect(
			owner.getByRole('button', { name: 'Rückgabe bestätigen' })
		).toHaveCount(0);
	});
});
