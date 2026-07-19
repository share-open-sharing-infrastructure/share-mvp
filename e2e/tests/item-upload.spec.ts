import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * The single-item add/edit modal on /user/items and the AI bulk-add dropzone. Runs with
 * the seeded owner's storage state (authenticated project).
 *
 * NB: this codebase's item modal is a single-image upload — the older multi-image #246
 * gallery/drag-and-drop design an earlier version of this spec targeted is not present
 * here, so the spec covers the current modal instead.
 */

// 1×1 PNG for the (image-required) create flow.
const PNG_1x1 = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

// In dev a route compiles on first hit, so an early click can land before Svelte hydrates
// the handler. Retry the opener until the modal opens.
async function openModalVia(page: Page, opener: Locator): Promise<Locator> {
	const dialog = page.getByRole('dialog');
	await expect(async () => {
		if (!(await dialog.isVisible())) await opener.click();
		await expect(dialog).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 15_000 });
	return dialog;
}

const openAddModal = (page: Page) =>
	openModalVia(page, page.getByRole('button', { name: 'Dinge einzeln hochladen' }));

test.describe('item modal', () => {
	test('opens the add-item modal with the create form', async ({ page }) => {
		await page.goto('/user/items');
		const dialog = await openAddModal(page);
		await expect(dialog.getByRole('textbox', { name: 'Name:' })).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Hinzufügen' })).toBeVisible();
	});

	test('creates an item with an image and lists it', async ({ page }) => {
		await page.goto('/user/items');
		const dialog = await openAddModal(page);

		const name = `E2E Neuware ${Date.now()}`;
		await dialog.getByRole('textbox', { name: 'Name:' }).fill(name);
		await dialog
			.getByRole('textbox', { name: 'Beschreibung:' })
			.fill('Playwright-Testgegenstand');
		await dialog.locator('input#itemImage').setInputFiles({
			name: 'item.png',
			mimeType: 'image/png',
			buffer: PNG_1x1,
		});
		await dialog.getByRole('button', { name: 'Hinzufügen' }).click();

		// Modal closes and the item shows in the list, linking to its detail page.
		await expect(dialog).toBeHidden();
		const link = page.getByRole('link', { name });
		await expect(link).toBeVisible();
		await link.click();
		await expect(page).toHaveURL(/\/items\/[^/]+$/);
	});

	test('the trustees info button reveals help without toggling the switch', async ({ page }) => {
		await page.goto('/user/items');
		const dialog = await openAddModal(page);

		const toggle = dialog.getByRole('checkbox', { name: 'Nur für Vertraute sichtbar' });
		await expect(toggle).toBeChecked(); // trustees-only is on by default
		await dialog.getByRole('button', { name: 'Erkläre mir das' }).first().click();
		await expect(dialog.getByText('Vertrauensfunktion')).toBeVisible();
		await expect(toggle).toBeChecked();
	});

	test('the edit modal pre-fills the item and offers save + delete', async ({ page }) => {
		await page.goto('/user/items');
		const dialog = await openModalVia(
			page,
			page.getByRole('button', { name: 'Bearbeiten' }).first()
		);
		await expect(dialog.getByRole('textbox', { name: 'Name:' })).toHaveValue(/.+/);
		await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Löschen' })).toBeVisible();
	});

	test('the bulk-add photo-upload area renders', async ({ page }) => {
		await page.goto('/user/items/bulk-add');
		await expect(page.getByRole('region', { name: 'Foto-Upload-Bereich' })).toBeVisible();
	});
});
