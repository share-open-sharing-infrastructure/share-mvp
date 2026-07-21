import { error, fail } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import {
	parseAndMapCsv,
	validateFileLimits,
	type RowResult,
	type MappedItem
} from '$lib/server/integrations/winbiap/csv';

export async function load({ locals }) {
	if (!locals.user?.isInstitution) {
		error(403, texts.institutional.importForbidden);
	}
	return {};
}

/** Returns the institution's owner id, or `null` if the caller is not an institutional account. */
function institutionOwnerId(locals: App.Locals): string | null {
	return locals.user?.isInstitution ? locals.user.id : null;
}

/**
 * A `SyncSummary` as returned by the backend `/api/import/apply` + `/api/import/refresh` endpoints.
 * `errors` is the list of write-error messages (frontend maps its length into the count summary).
 */
interface ImportSummary {
	institution: string;
	fetched: number;
	created: number;
	updated: number;
	archived: number;
	skipped: number;
	errors: string[];
	durationMs: number;
}

/** Diff forecast returned by the backend `/api/import/preview` dryRun endpoint (no write). */
interface ImportPreview {
	summary: { create: number; update: number; archive: number; skip: number };
	rowActions: Array<{ externalId: string; action: 'create' | 'update' | 'skip' }>;
	archiveRows: Array<{ id: string; externalId: string; name: string }>;
}

/** Strips the (server-stamped) `owner` before sending mapped rows to the backend. */
function toRow(item: MappedItem): Omit<MappedItem, 'owner'> {
	const { externalId, name, description, status, categories, externalUrl, externalImgUrl, place, trusteesOnly } =
		item;
	return { externalId, name, description, status, categories, externalUrl, externalImgUrl, place, trusteesOnly };
}

export const actions = {
	preview: async ({ locals, request }) => {
		const ownerId = institutionOwnerId(locals);
		if (!ownerId) {
			return fail(403, { error: true, message: texts.institutional.importNoPermission });
		}

		const formData = await request.formData();
		const file = formData.get('csv') as File | null;

		if (!file || !(file instanceof File) || file.size === 0) {
			return fail(400, { error: true, message: texts.institutional.importNoFile });
		}
		if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
			return fail(400, { error: true, message: texts.institutional.importXlsxError });
		}

		const csvText = await file.text();
		const { mappedRows, rowErrors, totalRows, parseError } = parseAndMapCsv(csvText, ownerId);
		if (parseError) {
			return fail(400, { error: true, message: parseError });
		}
		const limitError = validateFileLimits(csvText, totalRows);
		if (limitError) {
			return fail(400, { error: true, message: limitError });
		}

		// Backend computes the diff (dryRun) — the FE no longer reads the DB or diffs itself.
		let preview: ImportPreview;
		try {
			preview = await locals.pb.send('/api/import/preview', {
				method: 'POST',
				body: { rows: mappedRows.map(({ item }) => toRow(item)) }
			});
		} catch (err) {
			console.error('import preview failed:', (err as Partial<ClientResponseError>)?.message ?? err);
			return fail(503, { error: true, message: texts.institutional.importLoadExistingFailed });
		}

		// Merge the backend's per-externalId action onto the locally-parsed rows (for row number +
		// name + CSV warnings), then interleave the parser's row errors.
		const actionByExternalId = new Map(preview.rowActions.map((r) => [r.externalId, r.action]));
		const previewRows: RowResult[] = mappedRows.map(({ rowIndex, item, warnings }) => ({
			rowIndex,
			externalId: item.externalId,
			name: item.name,
			action: actionByExternalId.get(item.externalId) ?? 'skip',
			errors: warnings
		}));
		const rowResults = [...previewRows, ...rowErrors].sort((a, b) => a.rowIndex - b.rowIndex);

		return {
			success: true,
			preview: true,
			csvText,
			rowResults: rowResults.slice(0, 50),
			archiveRows: preview.archiveRows.map((r) => ({ ...r, action: 'archive' as const })),
			summary: {
				create: preview.summary.create,
				update: preview.summary.update,
				archive: preview.summary.archive,
				skip: preview.summary.skip,
				errors: rowErrors.length
			},
			totalRows
		};
	},

	apply: async ({ locals, request }) => {
		const ownerId = institutionOwnerId(locals);
		if (!ownerId) {
			return fail(403, { error: true, message: texts.institutional.importNoPermission });
		}

		const formData = await request.formData();
		const csvText = formData.get('csvText')?.toString() ?? '';
		if (!csvText) {
			return fail(400, { error: true, message: texts.institutional.importNoCsvData });
		}

		const { mappedRows, rowErrors, totalRows, parseError } = parseAndMapCsv(csvText, ownerId);
		if (parseError) {
			return fail(400, { error: true, message: parseError });
		}
		const limitError = validateFileLimits(csvText, totalRows);
		if (limitError) {
			return fail(400, { error: true, message: limitError });
		}

		// One user-session request; the backend stamps owner = caller and writes in a transaction.
		let summary: ImportSummary;
		try {
			summary = await locals.pb.send('/api/import/apply', {
				method: 'POST',
				body: { rows: mappedRows.map(({ item }) => toRow(item)) }
			});
		} catch (err) {
			console.error('import apply failed:', (err as Partial<ClientResponseError>)?.message ?? err);
			return fail(503, { error: true, message: texts.institutional.importApplyFailed });
		}

		return {
			success: true,
			done: true,
			summary: {
				created: summary.created,
				updated: summary.updated,
				archived: summary.archived,
				skipped: summary.skipped,
				errors: summary.errors.length + rowErrors.length
			},
			rowErrors: summary.errors
		};
	},

	refresh: async ({ locals }) => {
		const ownerId = institutionOwnerId(locals);
		if (!ownerId) {
			return fail(403, { error: true, message: texts.institutional.importNoPermission });
		}

		// Refreshes only the caller's own items (user session — no SYNC_SECRET, no ?institution=).
		try {
			await locals.pb.send('/api/import/refresh', { method: 'POST' });
		} catch (err) {
			console.error('import refresh failed:', (err as Partial<ClientResponseError>)?.message ?? err);
			return fail(503, { error: true, message: texts.institutional.importRefreshFailed });
		}

		return { success: true, refreshed: true, message: texts.institutional.importRefreshTriggered };
	}
};
