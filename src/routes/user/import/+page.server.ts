import { error, fail } from '@sveltejs/kit';
import {
	parseCsv,
	validateFileLimits,
	parseAndMapCsv,
	type RowResult,
} from '$lib/server/integrations/winbiap/csv';
import { loadExistingItems } from '$lib/server/integrations/core/pocketbase';
import { diffItems } from '$lib/server/integrations/core/diff';
import { applyDiff } from '$lib/server/integrations/core/write';

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

		const { rows: rawRows, error: parseError } = parseCsv(csvText);
		if (parseError) {
			return fail(400, { error: true, message: parseError });
		}

		const limitError = validateFileLimits(csvText, rawRows.length);
		if (limitError) {
			return fail(400, { error: true, message: limitError });
		}

		const ownerId = locals.user.id;
		const { mappedRows, rowErrors, totalRows } = parseAndMapCsv(csvText, ownerId);

		// Diff the mapped items against the institution's current items.
		let existingItems;
		try {
			existingItems = await loadExistingItems(locals.pb, ownerId);
		} catch {
			existingItems = []; // proceed without existing data — everything is treated as create
		}
		const diff = diffItems(
			mappedRows.map((r) => r.item),
			existingItems
		);

		// Derive the per-row action from which diff list each item landed in.
		const createIds = new Set(diff.toCreate.map((i) => i.externalId));
		const updateIds = new Set(diff.toUpdate.map((u) => u.data.externalId));
		const previewRows: RowResult[] = mappedRows.map(({ rowIndex, item, warnings }) => ({
			rowIndex,
			externalId: item.externalId ?? '',
			name: item.name,
			action: createIds.has(item.externalId)
				? 'create'
				: updateIds.has(item.externalId)
					? 'update'
					: 'skip',
			errors: warnings,
		}));

		const rowResults = [...previewRows, ...rowErrors].sort((a, b) => a.rowIndex - b.rowIndex);
		const skipped = previewRows.filter((r) => r.action === 'skip').length;
		const archiveRows = diff.toArchive.map((i) => ({
			id: i.id,
			externalId: i.externalId ?? '',
			name: i.name,
			action: 'archive' as const,
		}));

		const summary = {
			create: diff.toCreate.length,
			update: diff.toUpdate.length,
			archive: archiveRows.length,
			skip: skipped,
			errors: rowErrors.length,
		};

		return {
			success: true,
			preview: true,
			csvText,
			rowResults: rowResults.slice(0, 50),
			archiveRows,
			summary,
			totalRows,
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

		const { error: parseError } = parseCsv(csvText);
		if (parseError) {
			return fail(400, { error: true, message: parseError });
		}

		const ownerId = locals.user.id;
		const { mappedRows, rowErrors } = parseAndMapCsv(csvText, ownerId);

		let existingItems;
		try {
			existingItems = await loadExistingItems(locals.pb, ownerId);
		} catch {
			existingItems = [];
		}

		const diff = diffItems(
			mappedRows.map((r) => r.item),
			existingItems
		);

		// User-session client: never re-authenticate as superuser (default identity retry).
		const writes = await applyDiff(locals.pb, diff);

		return {
			success: true,
			done: true,
			summary: {
				created: writes.created,
				updated: writes.updated,
				archived: writes.archived,
				skipped: diff.skipped,
				errors: writes.errors.length + rowErrors.length,
			},
			rowErrors: writes.errors,
		};
	},
};
