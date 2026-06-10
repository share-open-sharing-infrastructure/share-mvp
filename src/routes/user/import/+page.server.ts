import { error, fail } from '@sveltejs/kit';
import {
	parseCsv,
	parseAndValidateRow,
	validateFileLimits,
	buildPreviewRows,
	type ParsedRow,
	type RowResult,
	type ArchiveRow,
	type PreviewSummary,
} from './importUtils';
import { archiveDescription, pbErrorMessage } from '$lib/server/itemArchive';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function load({ locals }) {
	if (!locals.user?.isInstitution) {
		error(403, 'Nur für institutionelle Accounts zugänglich.');
	}
	return {};
}

export const actions = {
	preview: async ({ locals, request }) => {
		if (!locals.user?.isInstitution) {
			return fail(403, { error: true, message: 'Keine Berechtigung.' });
		}

		const formData = await request.formData();
		const file = formData.get('csv') as File | null;

		if (!file || !(file instanceof File) || file.size === 0) {
			return fail(400, { error: true, message: 'Keine Datei hochgeladen.' });
		}

		if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
			return fail(400, { error: true, message: 'Bitte als CSV speichern und erneut hochladen.' });
		}

		const csvText = await file.text();

		// Validate size/row limits before parsing
		const { rows: rawRows, error: parseError } = parseCsv(csvText);
		if (parseError) {
			return fail(400, { error: true, message: parseError });
		}

		const limitError = validateFileLimits(csvText, rawRows.length);
		if (limitError) {
			return fail(400, { error: true, message: limitError });
		}

		// Parse and validate each row
		const validRows: ParsedRow[] = [];
		const rowResults: RowResult[] = [];
		const seenExternalIds = new Set<string>();
		const duplicates = new Set<string>();

		for (let i = 0; i < rawRows.length; i++) {
			const { parsed, errors } = parseAndValidateRow(rawRows[i]);
			if (errors.length > 0 || !parsed) {
				rowResults.push({
					rowIndex: i + 2,
					externalId: rawRows[i]['externalId'] ?? '',
					name: rawRows[i]['name'] ?? '',
					action: 'error',
					errors,
				});
				continue;
			}
			if (seenExternalIds.has(parsed.externalId)) {
				duplicates.add(parsed.externalId);
			}
			seenExternalIds.add(parsed.externalId);
			validRows.push(parsed);
		}

		// Look up which externalIds already exist for this owner
		const ownerId = locals.user.id;
		let existingItems: Array<{ id: string; externalId: string; name: string }> = [];
		try {
			existingItems = await locals.pb.collection('items').getFullList({
				filter: `owner = "${ownerId}" && externalId != ""`,
				fields: 'id,externalId,name',
			});
		} catch {
			// proceed without existing data — everything will be treated as create
		}

		const existingByExternalId = new Map(existingItems.map((i) => [i.externalId, i]));
		const existingExternalIdSet = new Set(existingByExternalId.keys());

		// Build preview rows for valid rows
		const previewRows = buildPreviewRows(validRows, existingExternalIdSet, duplicates);
		for (const r of previewRows) {
			rowResults.push(r);
		}
		rowResults.sort((a, b) => a.rowIndex - b.rowIndex);

		// Compute archive candidates: items in DB not in the imported set
		const importedExternalIds = new Set(validRows.map((r) => r.externalId));
		const archiveRows: ArchiveRow[] = existingItems
			.filter((i) => !importedExternalIds.has(i.externalId))
			.map((i) => ({ id: i.id, externalId: i.externalId, name: i.name, action: 'archive' as const }));

		const summary: PreviewSummary = {
			create: previewRows.filter((r) => r.action === 'create').length,
			update: previewRows.filter((r) => r.action === 'update').length,
			archive: archiveRows.length,
			skip: 0,
			errors: rowResults.filter((r) => r.action === 'error').length,
		};

		return {
			success: true,
			preview: true,
			csvText,
			rowResults: rowResults.slice(0, 50),
			archiveRows,
			summary,
			totalRows: rawRows.length,
		};
	},

	apply: async ({ locals, request }) => {
		if (!locals.user?.isInstitution) {
			return fail(403, { error: true, message: 'Keine Berechtigung.' });
		}

		const formData = await request.formData();
		const csvText = formData.get('csvText')?.toString() ?? '';

		if (!csvText) {
			return fail(400, { error: true, message: 'Keine CSV-Daten vorhanden.' });
		}

		const { rows: rawRows, error: parseError } = parseCsv(csvText);
		if (parseError) {
			return fail(400, { error: true, message: parseError });
		}

		const ownerId = locals.user.id;

		// Re-validate all rows
		const validRows: ParsedRow[] = [];
		let errorCount = 0;
		for (let i = 0; i < rawRows.length; i++) {
			const { parsed } = parseAndValidateRow(rawRows[i]);
			if (parsed) validRows.push(parsed);
			else errorCount++;
		}

		// Look up existing items
		let existingItems: Array<{ id: string; externalId: string; description: string }> = [];
		try {
			existingItems = await locals.pb.collection('items').getFullList({
				filter: `owner = "${ownerId}" && externalId != ""`,
				fields: 'id,externalId,description',
			});
		} catch {
			// proceed
		}
		const existingByExternalId = new Map(existingItems.map((i) => [i.externalId, i]));

		let created = 0;
		let updated = 0;
		const rowErrors: string[] = [];

		const importedExternalIds = new Set<string>();
		for (const row of validRows) {
			importedExternalIds.add(row.externalId);
		}

		// Separate creates and updates — the *:create rate limit (20/5s by default) only affects creates.
		// Fix: in PocketBase Dashboard → Settings → Rate limits, set *:create audience to "guest"
		// so authenticated imports are not throttled. This code also batches conservatively as a fallback.
		//
		// Updates use batches of 50 (no strict update rate limit).
		// Creates use batches of 15 with a 5.5s pause between chunks (stays under 20/5s).
		const UPDATE_BATCH = 50;
		const CREATE_BATCH = 15;
		const CREATE_PAUSE_MS = 5500;

		const toCreate: typeof validRows = [];
		const toUpdate: Array<{ row: (typeof validRows)[0]; existingId: string }> = [];

		for (const row of validRows) {
			const existing = existingByExternalId.get(row.externalId);
			if (existing) toUpdate.push({ row, existingId: existing.id });
			else toCreate.push(row);
		}

		// Build the PocketBase fields object for a row. description is made optional in PocketBase
		// (uncheck Required on the field) — but we also send '' so the API never gets undefined.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const rowFields = (row: (typeof validRows)[0]): Record<string, any> => ({
			name: row.name,
			description: row.description ?? '',
			place: row.place,
			categories: row.categories,
			externalUrl: row.externalUrl,
			externalImgUrl: row.image,
			status: row.status,
			trusteesOnly: row.trusteesOnly,
		});

		// --- Updates ---
		for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
			const chunk = toUpdate.slice(i, i + UPDATE_BATCH);
			const batch = locals.pb.createBatch();
			for (const { row, existingId } of chunk) {
				batch.collection('items').update(existingId, rowFields(row));
			}
			try {
				await batch.send();
				updated += chunk.length;
			} catch (err) {
				const msg = pbErrorMessage(err);
				console.error(`[import] update batch failed:`, msg);
				for (const { row } of chunk) rowErrors.push(`${row.externalId}: ${msg}`);
			}
			if (i + UPDATE_BATCH < toUpdate.length) await delay(300);
		}

		// --- Creates ---
		for (let i = 0; i < toCreate.length; i += CREATE_BATCH) {
			const chunk = toCreate.slice(i, i + CREATE_BATCH);
			const batch = locals.pb.createBatch();
			for (const row of chunk) {
				batch.collection('items').create({ owner: ownerId, externalId: row.externalId, ...rowFields(row) });
			}
			try {
				await batch.send();
				created += chunk.length;
			} catch (err) {
				const msg = pbErrorMessage(err);
				console.error(`[import] create batch failed:`, msg);
				for (const row of chunk) rowErrors.push(`${row.externalId}: ${msg}`);
			}
			if (i + CREATE_BATCH < toCreate.length) await delay(CREATE_PAUSE_MS);
		}

		// Archive items not in the imported set (also batched)
		let archived = 0;
		const toArchive = existingItems.filter((i) => !importedExternalIds.has(i.externalId));

		for (let i = 0; i < toArchive.length; i += UPDATE_BATCH) {
			const chunk = toArchive.slice(i, i + UPDATE_BATCH);
			const batch = locals.pb.createBatch();
			const chunkIds: string[] = [];

			for (const item of chunk) {
				batch.collection('items').update(item.id, {
					status: 'unavailable',
					description: archiveDescription(item.description),
				});
				chunkIds.push(item.id);
			}

			try {
				await batch.send();
				archived += chunkIds.length;
			} catch (err) {
				const msg = pbErrorMessage(err);
				console.error(`[import] archive batch failed:`, msg);
				for (const id of chunkIds) rowErrors.push(`archive ${id}: ${msg}`);
			}

			if (i + UPDATE_BATCH < toArchive.length) await delay(300);
		}

		return {
			success: true,
			done: true,
			summary: {
				created,
				updated,
				archived,
				errors: rowErrors.length + errorCount,
			},
			rowErrors,
		};
	},
};
