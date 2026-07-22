import { test, expect } from '@playwright/test';

/**
 * Toasts over modals (#523) — the ToastHost is portalled into the topmost open modal
 * `<dialog>` while one is open, so its toasts paint above the dialog's ::backdrop (a
 * body-level overlay can't — the modal backdrop wins). Runs in the `authenticated`
 * project ('/' requires auth). We open the real feedback modal (same opener as
 * feedback.spec.ts, retried for the dev hydration race), push a toast while it's open,
 * and assert the toast is both visible and the top-most element hit at its own centre.
 * Note the host is now NESTED inside the dialog, so it's expected to be within the dialog
 * DOM — the meaningful check is that the toast host wins the hit-test.
 */

test.describe('toast over modal', () => {
	test('a toast pushed while a modal is open paints above the modal', async ({ page }) => {
		await page.goto('/');

		// Open the feedback modal exactly as feedback.spec.ts does (retry the opener
		// until the dialog is visible — handles the dev-server hydration race).
		const dialog = page.getByRole('dialog');
		await expect(async () => {
			await page.getByRole('button', { name: 'Feedback' }).first().click();
			await expect(dialog).toBeVisible({ timeout: 1000 });
		}).toPass({ timeout: 15_000 });

		// Push a toast while the modal is open. duration 0 = no auto-dismiss so the
		// assertions can't race the timer. pushToast(type, message, duration).
		await page.evaluate(async () => {
			const m = await import('/src/lib/stores/toast.svelte.ts');
			m.pushToast('success', 'E2E toast over modal', 0);
		});

		const toast = page.getByText('E2E toast over modal');
		await expect(toast).toBeVisible();

		// Stacking check: the element hit-tested at the toast's own centre must belong to
		// the ToastHost subtree (`[data-toast-host]`). That the toast host is the top-most
		// hit — rather than the dialog's backdrop/content — proves the toast paints above
		// the modal, which is the whole point of #523.
		const hitInsideHost = await toast.evaluate((el) => {
			const rect = el.getBoundingClientRect();
			const cx = rect.left + rect.width / 2;
			const cy = rect.top + rect.height / 2;
			const hit = document.elementFromPoint(cx, cy);
			return !!hit?.closest('[data-toast-host]');
		});

		expect(hitInsideHost).toBe(true);
	});
});
