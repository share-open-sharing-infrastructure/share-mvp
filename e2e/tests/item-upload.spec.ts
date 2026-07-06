import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Item upload improvements (#246): the single-item modal on /user/items and the
 * AI-upload dropzone. Runs with the seeded owner's storage state (auth.setup.ts).
 */

const PNG_B64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PNG_1x1 = Buffer.from(PNG_B64, 'base64');
const IMAGE_UPLOAD = 'Bilder hochladen oder hierher ziehen'; // dropzone aria-label

// In dev the route compiles on first hit, so an early click can land before Svelte
// hydrates the handler. Retry the opener click until the modal actually opens.
async function openModal(page: Page, opener: Locator) {
	await expect(opener).toBeVisible();
	await expect(async () => {
		await opener.click();
		await expect(page.getByRole('dialog')).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 15_000 });
	return page.getByRole('dialog');
}

function openAddModal(page: Page) {
	return openModal(page, page.getByRole('button', { name: /Dinge einzeln hochladen/ }));
}

test.describe('item upload (#246)', () => {
	test('desktop layout puts the image column left of the fields', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/user/items');
		const dialog = await openAddModal(page);

		const imgBox = await dialog.locator('img').first().boundingBox();
		const nameBox = await dialog.getByRole('textbox', { name: 'Name:' }).boundingBox();
		expect(imgBox).not.toBeNull();
		expect(nameBox).not.toBeNull();
		// Image column is entirely to the LEFT of the fields (side-by-side, not stacked).
		expect(imgBox!.x + imgBox!.width).toBeLessThanOrEqual(nameBox!.x + 5);
	});

	test('clicking the image area opens the (multiple) file picker', async ({ page }) => {
		await page.goto('/user/items');
		const dialog = await openAddModal(page);

		const chooserPromise = page.waitForEvent('filechooser');
		await dialog.getByRole('button', { name: IMAGE_UPLOAD }).click();
		const chooser = await chooserPromise;
		expect(chooser.isMultiple()).toBe(true);
	});

	test('drag & drop adds an image thumbnail', async ({ page }) => {
		await page.goto('/user/items');
		const dialog = await openAddModal(page);

		const dataTransfer = await page.evaluateHandle((b64) => {
			const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
			const dt = new DataTransfer();
			dt.items.add(new File([bytes], 'drop.png', { type: 'image/png' }));
			return dt;
		}, PNG_B64);

		const dropzone = dialog.getByRole('button', { name: IMAGE_UPLOAD });
		await dropzone.dispatchEvent('dragover', { dataTransfer });
		await dropzone.dispatchEvent('drop', { dataTransfer });

		await expect(dialog.getByRole('button', { name: 'Bild entfernen' })).toHaveCount(1);
	});

	test('uploads a new item with multiple images and shows a working gallery', async ({ page }) => {
		await page.goto('/user/items');
		const dialog = await openAddModal(page);
		await expect(dialog.getByRole('heading', { name: 'Neuer Gegenstand' })).toBeVisible();

		await dialog.locator('input[type="file"]').setInputFiles([
			{ name: 'a.png', mimeType: 'image/png', buffer: PNG_1x1 },
			{ name: 'b.png', mimeType: 'image/png', buffer: PNG_1x1 },
		]);
		await expect(dialog.getByRole('button', { name: 'Bild entfernen' })).toHaveCount(2);

		const name = `E2E Multi-Upload ${Date.now()}`;
		await dialog.getByRole('textbox', { name: 'Name:' }).fill(name);
		await dialog.getByRole('textbox', { name: 'Beschreibung:' }).fill('Playwright (#246)');
		await dialog.getByRole('button', { name: 'Hinzufügen' }).click();

		// Modal closes and the item appears in the list with a rendered cover thumbnail.
		await expect(dialog).toBeHidden();
		const row = page.locator('div', { hasText: name }).filter({
			has: page.getByRole('link', { name }),
		});
		const cover = row.locator('img').first();
		await expect
			.poll(() => cover.evaluate((el) => (el as HTMLImageElement).naturalWidth))
			.toBeGreaterThan(0);

		// Detail page: gallery with one thumbnail per image; the hero image really renders.
		await page.getByRole('link', { name }).first().click();
		await expect(page).toHaveURL(/\/items\/[^/]+$/);
		const hero = page.locator('main img').first();
		await expect
			.poll(() => hero.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 10_000 })
			.toBeGreaterThan(0);

		const thumbs = page.getByRole('button', { name: /Bild \d+ anzeigen/ });
		await expect(thumbs).toHaveCount(2);
		const src1 = await hero.getAttribute('src');
		await thumbs.nth(1).click();
		await expect.poll(() => hero.getAttribute('src')).not.toBe(src1);
	});

	test('caps image selection at 5 and warns', async ({ page }) => {
		await page.goto('/user/items');
		const dialog = await openAddModal(page);

		const files = Array.from({ length: 7 }, (_, i) => ({
			name: `f${i}.png`,
			mimeType: 'image/png',
			buffer: PNG_1x1,
		}));
		await dialog.locator('input[type="file"]').setInputFiles(files);

		await expect(dialog.getByRole('button', { name: 'Bild entfernen' })).toHaveCount(5);
		await expect(dialog.getByText(/Maximal 5 Bilder/)).toBeVisible();
	});

	test('removing a selected image drops its thumbnail', async ({ page }) => {
		await page.goto('/user/items');
		const dialog = await openAddModal(page);

		await dialog.locator('input[type="file"]').setInputFiles([
			{ name: 'a.png', mimeType: 'image/png', buffer: PNG_1x1 },
			{ name: 'b.png', mimeType: 'image/png', buffer: PNG_1x1 },
		]);
		const removeButtons = dialog.getByRole('button', { name: 'Bild entfernen' });
		await expect(removeButtons).toHaveCount(2);
		await removeButtons.first().click();
		await expect(removeButtons).toHaveCount(1);
	});

	test('warns before discarding unsaved changes on ESC', async ({ page }) => {
		await page.goto('/user/items');
		const dialog = await openAddModal(page);
		await dialog.getByRole('textbox', { name: 'Name:' }).fill('Halbfertig');

		page.once('dialog', (d) => d.dismiss());
		await page.keyboard.press('Escape');
		await expect(dialog).toBeVisible();

		page.once('dialog', (d) => d.accept());
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
	});

	test('warns before discarding unsaved changes via the close (X) button', async ({ page }) => {
		await page.goto('/user/items');
		const dialog = await openAddModal(page);
		await dialog.getByRole('textbox', { name: 'Name:' }).fill('Halbfertig');

		page.once('dialog', (d) => d.dismiss());
		await dialog.getByRole('button', { name: 'Close' }).click();
		await expect(dialog).toBeVisible();
	});

	test('the trustees info button shows help without toggling the visibility switch', async ({
		page,
	}) => {
		await page.goto('/user/items');
		const dialog = await openAddModal(page);

		const toggle = dialog.getByRole('checkbox', { name: 'Nur für Vertraute sichtbar' });
		await expect(toggle).toBeChecked(); // on by default
		await dialog.getByRole('button', { name: 'Erkläre mir das' }).first().click();
		await expect(toggle).toBeChecked();
		await expect(dialog.getByText('Vertrauensfunktion')).toBeVisible();
	});

	test('the edit modal shows the existing image and its availability info does not toggle', async ({
		page,
	}) => {
		await page.goto('/user/items');
		const row = page.locator('div.flex.items-center', { hasText: 'E2E Bohrmaschine' }).first();
		const dialog = await openModal(page, row.getByRole('button', { name: 'Bearbeiten' }));

		await expect(dialog.getByRole('heading', { name: 'Gegenstand bearbeiten' })).toBeVisible();
		await expect
			.poll(() => dialog.locator('img').first().evaluate((el) => (el as HTMLImageElement).naturalWidth))
			.toBeGreaterThan(0);

		const avail = dialog.getByRole('checkbox', { name: /Verfügbar|Nicht verfügbar/ });
		const before = await avail.isChecked();
		// Availability info button is the second "Erkläre mir das" (after the trustees one).
		await dialog.getByRole('button', { name: 'Erkläre mir das' }).nth(1).click();
		expect(await avail.isChecked()).toBe(before);
	});

	test('shows a clear error for an image the browser cannot decode', async ({ page }) => {
		await page.goto('/user/items');
		const dialog = await openAddModal(page);

		await dialog.locator('input[type="file"]').setInputFiles({
			name: 'photo.heic',
			mimeType: 'image/heic',
			buffer: Buffer.from('this is not a decodable image'),
		});
		await dialog.getByRole('textbox', { name: 'Name:' }).fill('HEIC Test');
		await dialog.getByRole('textbox', { name: 'Beschreibung:' }).fill('sollte fehlschlagen');
		await dialog.getByRole('button', { name: 'Hinzufügen' }).click();

		await expect(dialog.getByText(/konnte nicht verarbeitet werden/)).toBeVisible();
		await expect(dialog).toBeVisible(); // stays open; nothing submitted
	});

	test('the AI-upload dropzone is transparent', async ({ page }) => {
		await page.goto('/user/items/bulk-add');
		const dropzone = page.getByRole('region', { name: 'Foto-Upload-Bereich' });
		await expect(dropzone).toBeVisible();
		const bg = await dropzone.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(bg).toBe('rgba(0, 0, 0, 0)');
	});
});
