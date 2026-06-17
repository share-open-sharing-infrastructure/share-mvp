import { error, fail } from '@sveltejs/kit';
import type PocketBase from 'pocketbase';
import {
	parseCsv,
	validateFileLimits,
	parseAndMapCsv,
	type MappedRow,
	type RowResult,
} from '$lib/server/integrations/winbiap/csv';
import { loadExistingItems } from '$lib/server/integrations/core/pocketbase';
import { diffItems } from '$lib/server/integrations/core/diff';
import { applyDiff } from '$lib/server/integrations/core/write';
import type { DiffResult } from '$lib/server/integrations/core/types';

export async function load({ locals }) {
	if (!locals.user?.isInstitution) {
		error(403, 'Nur für institutionelle Accounts zugänglich.');
	}
	return {};
}

/** Returns the institution's owner id, or `null` if the caller is not an institutional account. */
function institutionOwnerId(locals: App.Locals): string | null {
	return locals.user?.isInstitution ? locals.user.id : null;
}

interface CsvDiff {
	mappedRows: MappedRow[];
	rowErrors: RowResult[];
	totalRows: number;
	diff: DiffResult;
}

/**
 * Parses + maps a CSV and diffs it against the institution's current items — the shared
 * orchestration behind both the `preview` and `apply` actions. Lets a failed item load
 * propagate (rather than silently treating every row as a create), so callers can abort.
 */
async function buildCsvDiff(pb: PocketBase, csvText: string, ownerId: string): Promise<CsvDiff> {
	const { mappedRows, rowErrors, totalRows } = parseAndMapCsv(csvText, ownerId);
	const existingItems = await loadExistingItems(pb, ownerId);
	const diff = diffItems(
		mappedRows.map((r) => r.item),
		existingItems
	);
	return { mappedRows, rowErrors, totalRows, diff };
}

export const actions = {
	preview: async ({ locals, request }) => {
		const ownerId = institutionOwnerId(locals);
		if (!ownerId) {
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

		let mappedRows, rowErrors, totalRows, diff;
		try {
			({ mappedRows, rowErrors, totalRows, diff } = await buildCsvDiff(locals.pb, csvText, ownerId));
		} catch {
			return fail(503, {
				error: true,
				message: 'Bestehende Artikel konnten nicht geladen werden. Bitte später erneut versuchen.',
			});
		}

		// Derive the per-row action from which diff list each item landed in.
		const createIds = new Set(diff.toCreate.map((i) => i.externalId));
		const updateIds = new Set(diff.toUpdate.map((u) => u.data.externalId));
		const previewRows: RowResult[] = mappedRows.map(({ rowIndex, item, warnings }) => ({
			rowIndex,
			externalId: item.externalId,
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
		const ownerId = institutionOwnerId(locals);
		if (!ownerId) {
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

		let rowErrors, diff;
		try {
			({ rowErrors, diff } = await buildCsvDiff(locals.pb, csvText, ownerId));
		} catch {
			return fail(503, {
				error: true,
				message: 'Bestehende Artikel konnten nicht geladen werden. Bitte später erneut versuchen.',
			});
		}

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
