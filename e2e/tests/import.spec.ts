import { test, expect } from '@playwright/test';
import { INSTITUTION_STORAGE_STATE } from '../fixtures/users';

/**
 * Institutional CSV import (/user/import) — an institution uploads a WINBIAP-shaped CSV,
 * previews the per-row actions, and applies it. Runs as the seeded institution account in
 * the `multiuser` project. Created items are owned by the seed institution, so the seed
 * teardown removes them on the next run.
 */

const CSV = [
	'externalId,name,description,place,categories,status,trusteesOnly',
	'e2e-imp-1,E2E Import Bohrer,Testbohrer,Lüneburg,Werkzeug und Garten,available,false',
	'e2e-imp-2,E2E Import Zelt,Testzelt,Lüneburg,Reisen und Outdoor,available,false',
].join('\n');

test.describe('institutional import', () => {
	test('an institution previews and applies a CSV import', async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: INSTITUTION_STORAGE_STATE });
		const page = await ctx.newPage();
		try {
			await page.goto('/user/import');
			await expect(
				page.getByRole('heading', { name: 'Bestand als CSV importieren' })
			).toBeVisible();

			// Upload the CSV; the preview button enables once the file is picked (needs hydration).
			const preview = page.getByRole('button', { name: 'Vorschau laden' });
			await expect(async () => {
				await page.locator('input#csv').setInputFiles({
					name: 'import.csv',
					mimeType: 'text/csv',
					buffer: Buffer.from(CSV, 'utf-8'),
				});
				await expect(preview).toBeEnabled({ timeout: 1000 });
			}).toPass({ timeout: 15_000 });
			await preview.click();

			// Preview lists the CSV rows.
			await expect(page.getByText('E2E Import Bohrer')).toBeVisible();
			await expect(page.getByText('E2E Import Zelt')).toBeVisible();

			// Apply → done.
			await page.getByRole('button', { name: 'Importieren' }).click();
			await expect(
				page.getByRole('heading', { name: 'Import abgeschlossen' })
			).toBeVisible();
		} finally {
			await ctx.close();
		}
	});
});
