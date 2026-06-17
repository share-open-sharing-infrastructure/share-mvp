import { error, fail, type ActionFailure } from '@sveltejs/kit';
import type PocketBase from 'pocketbase';
import {
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

type FormFailure = ActionFailure<{ error: true; message: string }>;

interface CsvDiff {
	mappedRows: MappedRow[];
	rowErrors: RowResult[];
	totalRows: number;
	diff: DiffResult;
}

/**
 * Outcome of `loadCsvDiff`: either a usable `CsvDiff` (`ok`) or a ready-to-return action
 * `failure` the caller should hand straight back to SvelteKit.
 */
type LoadCsvDiffResult = { ok: true; value: CsvDiff } | { ok: false; failure: FormFailure };

/**
 * Parses + maps a CSV once and diffs it against the institution's current items — the shared
 * orchestration behind both the `preview` and `apply` actions. Translates the two non-success
 * outcomes into action failures: a fatally malformed CSV (`400`, before any DB read) and a
 * failed item load (`503`, rather than silently treating every row as a create).
 */
async function loadCsvDiff(
	pb: PocketBase,
	csvText: string,
	ownerId: string
): Promise<LoadCsvDiffResult> {
	const { mappedRows, rowErrors, totalRows, parseError } = parseAndMapCsv(csvText, ownerId);
	if (parseError) {
		return { ok: false, failure: fail(400, { error: true, message: parseError }) };
	}

	let existingItems;
	try {
		existingItems = await loadExistingItems(pb, ownerId);
	} catch {
		return {
			ok: false,
			failure: fail(503, {
				error: true,
				message: 'Bestehende Artikel konnten nicht geladen werden. Bitte später erneut versuchen.',
			}),
		};
	}

	const diff = diffItems(
		mappedRows.map((r) => r.item),
		existingItems
	);
	return { ok: true, value: { mappedRows, rowErrors, totalRows, diff } };
}

/** Builds the preview payload: per-row actions, the archive list, and a count summary. */
function toPreviewResponse({ mappedRows, rowErrors, totalRows, diff }: CsvDiff, csvText: string) {
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
	const archiveRows = diff.toArchive.map((i) => ({
		id: i.id,
		externalId: i.externalId ?? '',
		name: i.name,
		action: 'archive' as const,
	}));

	return {
		success: true,
		preview: true,
		csvText,
		rowResults: rowResults.slice(0, 50),
		archiveRows,
		summary: {
			create: diff.toCreate.length,
			update: diff.toUpdate.length,
			archive: archiveRows.length,
			skip: previewRows.filter((r) => r.action === 'skip').length,
			errors: rowErrors.length,
		},
		totalRows,
	};
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

		const result = await loadCsvDiff(locals.pb, csvText, ownerId);
		if (!result.ok) return result.failure;

		const limitError = validateFileLimits(csvText, result.value.totalRows);
		if (limitError) {
			return fail(400, { error: true, message: limitError });
		}

		return toPreviewResponse(result.value, csvText);
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

		const result = await loadCsvDiff(locals.pb, csvText, ownerId);
		if (!result.ok) return result.failure;

		// User-session client: never re-authenticate as superuser (default identity retry).
		const writes = await applyDiff(locals.pb, result.value.diff);

		return {
			success: true,
			done: true,
			summary: {
				created: writes.created,
				updated: writes.updated,
				archived: writes.archived,
				skipped: result.value.diff.skipped,
				errors: writes.errors.length + result.value.rowErrors.length,
			},
			rowErrors: writes.errors,
		};
	},
};
