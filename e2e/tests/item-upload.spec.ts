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

// Regression for #546: in one SPA session (no reload), a category chosen on an item must
// survive repeated edit-save cycles. Before the fix the edit modal's category checkbox went
// stale after the first in-session edit, and the next save persisted categories=[].
test.describe('item category staleness (#546)', () => {
	const category = (dialog: Locator) => dialog.getByRole('checkbox', { name: 'Bücher' });

	test('keeps a category checked across repeated edits without a page reload', async ({
		page,
	}) => {
		await page.goto('/user/items');

		// 1. Create an item with a name, description, image AND one category (Bücher).
		const name = `E2E Kategorie ${Date.now()}`;
		const addDialog = await openAddModal(page);
		await addDialog.getByRole('textbox', { name: 'Name:' }).fill(name);
		await addDialog
			.getByRole('textbox', { name: 'Beschreibung:' })
			.fill('Erste Beschreibung');
		await addDialog.locator('input#itemImage').setInputFiles({
			name: 'item.png',
			mimeType: 'image/png',
			buffer: PNG_1x1,
		});
		await category(addDialog).check();
		await addDialog.getByRole('button', { name: 'Hinzufügen' }).click();
		await expect(addDialog).toBeHidden();

		// The new row's edit button, targeted via the item's unique name.
		const row = page.locator('div.border-b', { has: page.getByRole('link', { name }) });
		const editBtn = row.getByRole('button', { name: 'Bearbeiten' });

		// 2. Open the edit modal — the category reflects the persisted state (checked).
		let dialog = await openModalVia(page, editBtn);
		await expect(category(dialog)).toBeChecked();

		// 3. Change ONLY the description, then save.
		await dialog.getByRole('textbox', { name: 'Beschreibung:' }).fill('Zweite Beschreibung');
		await dialog.getByRole('button', { name: 'Speichern' }).click();
		await expect(dialog).toBeHidden();

		// 4. Reopen — the category must STILL be checked (the core #546 assertion), then save.
		dialog = await openModalVia(page, editBtn);
		await expect(category(dialog)).toBeChecked();
		await dialog.getByRole('button', { name: 'Speichern' }).click();
		await expect(dialog).toBeHidden();

		// 5. Reopen once more — still checked (guards the "saved empty once, stays empty" state).
		dialog = await openModalVia(page, editBtn);
		await expect(category(dialog)).toBeChecked();
	});
});

// Regression for #395 + #455: the item description keeps its line breaks (rendered via a
// `whitespace-pre-line` wrapper) and http(s) URLs are turned into safe, clickable links
// (target=_blank + noopener/noreferrer/nofollow) on the public detail page.
test.describe('item description line breaks & links (#395 #455)', () => {
	test('renders newlines as pre-line and linkifies a URL on the detail page', async ({ page }) => {
		await page.goto('/user/items');
		const dialog = await openAddModal(page);

		const name = `E2E Beschreibung ${Date.now()}`;
		const url = 'https://example.com/anleitung';
		await dialog.getByRole('textbox', { name: 'Name:' }).fill(name);
		await dialog
			.getByRole('textbox', { name: 'Beschreibung:' })
			.fill(`Zeile eins\nZeile zwei\nMehr unter ${url}`);
		await dialog.locator('input#itemImage').setInputFiles({
			name: 'item.png',
			mimeType: 'image/png',
			buffer: PNG_1x1,
		});
		await dialog.getByRole('button', { name: 'Hinzufügen' }).click();

		// Modal closes; open the new item's detail page from its list row.
		await expect(dialog).toBeHidden();
		const row = page.getByRole('link', { name });
		await expect(row).toBeVisible();
		await row.click();
		await expect(page).toHaveURL(/\/items\/[^/]+$/);

		// The URL became a clickable link with the exact href and safe target/rel.
		const link = page.getByRole('link', { name: url });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('href', url);
		await expect(link).toHaveAttribute('target', '_blank');
		await expect(link).toHaveAttribute('rel', /noopener/);
		await expect(link).toHaveAttribute('rel', /noreferrer/);
		await expect(link).toHaveAttribute('rel', /nofollow/);

		// The wrapping <p> preserves the entered line breaks (CSS, not stored markup).
		const description = page.locator('p', { has: link });
		await expect(description).toHaveCSS('white-space', 'pre-line');
	});
});
