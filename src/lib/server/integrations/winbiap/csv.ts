import Papa from 'papaparse';
import { texts } from '$lib/texts';
import { ITEM_CATEGORIES } from '$lib/categories';
import type { Item } from '$lib/types/models';

const csvErrors = texts.institutional.importCsvErrors;

export type ImportStatus = 'available' | 'unavailable' | 'unknown';

/**
 * The item fields the CSV import produces for one row — the synced content fields plus `owner`,
 * `trusteesOnly`, and the `externalId` upsert key. Sent (minus `owner`) to the backend
 * `/api/import/*` endpoints, which stamp the owner and run the authoritative diff/write.
 *
 * #487 Phase 3: this used to live in `integrations/core/types.ts` (`MappedItem`); that whole core
 * layer moved to the backend (`pb_hooks/integrations/`), so the shape now lives here beside its
 * only remaining producer. It must stay field-compatible with the backend's `SYNCED_FIELDS`.
 */
export type MappedItem = Pick<
	Item,
	| 'name'
	| 'description'
	| 'status'
	| 'categories'
	| 'externalUrl'
	| 'externalImgUrl'
	| 'place'
	| 'owner'
	| 'trusteesOnly'
> & { externalId: string };
export type RowAction = 'create' | 'update' | 'skip' | 'archive';

/** One validated CSV row, before being mapped to a core `MappedItem`. */
export interface ParsedRow {
	externalId: string;
	name: string;
	description: string;
	place: string;
	categories: string[];
	externalUrl: string;
	status: ImportStatus;
	trusteesOnly: boolean;
	/** External image URL from the CSV — saved to items.externalImgUrl (no file download needed) */
	image: string;
}

/** A row's preview classification (or validation error) for display in the import UI. */
export interface RowResult {
	rowIndex: number;
	externalId: string;
	name: string;
	action: RowAction | 'error';
	errors: string[];
}

/** A valid CSV row mapped to a core item, carrying its source row number and any warnings. */
export interface MappedRow {
	rowIndex: number;
	item: MappedItem;
	warnings: string[];
}

/** Result of parsing, validating, and mapping an uploaded CSV. */
export interface ParseAndMapResult {
	/** Valid rows mapped to core items, in file order. */
	mappedRows: MappedRow[];
	/** Invalid rows (with their validation errors), for display. */
	rowErrors: RowResult[];
	/** Total data rows in the file (excluding the header). */
	totalRows: number;
	/** Fatal CSV parse error (malformed delimiter/quotes), if any; `mappedRows` is empty when set. */
	parseError?: string;
}

const MAX_FILE_SIZE_BYTES = 1_000_000;
const MAX_ROWS = 5_000;

function normalizeStatus(
	raw: string | undefined,
	externalUrl: string
): { status: ImportStatus; error?: string } {
	if (!raw || raw.trim() === '') {
		return { status: externalUrl ? 'unknown' : 'available' };
	}
	const s = raw.trim().toLowerCase();
	if (s === 'available' || s === 'unavailable' || s === 'unknown') {
		return { status: s };
	}
	// Placeholder status alongside the error (mirrors normalizeCategories); the caller
	// discards the parsed row whenever any error is present.
	return { status: 'unknown', error: csvErrors.invalidStatus(raw) };
}

function normalizeCategories(raw: string | undefined): { categories: string[]; error?: string } {
	if (!raw || raw.trim() === '') return { categories: [] };
	const parts = raw
		.split(';')
		.map((s) => s.trim())
		.filter(Boolean);
	const invalid = parts.filter((p) => !(ITEM_CATEGORIES as readonly string[]).includes(p));
	if (invalid.length > 0) {
		return { categories: [], error: csvErrors.invalidCategories(invalid.join(', ')) };
	}
	if (parts.length > 3) {
		return { categories: parts.slice(0, 3), error: csvErrors.tooManyCategories };
	}
	return { categories: parts };
}

function normalizeBool(raw: string | undefined): boolean {
	return raw?.trim().toLowerCase() === 'true';
}

export function parseAndValidateRow(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	row: Record<string, any>
): { parsed: ParsedRow | null; errors: string[] } {
	const errors: string[] = [];

	const externalId = row['externalId']?.toString().trim() ?? '';
	if (!externalId) errors.push(csvErrors.externalIdRequired);

	const name = row['name']?.toString().trim() ?? '';
	if (!name) errors.push(csvErrors.nameRequired);
	if (name.length > 200) errors.push(csvErrors.nameTooLong);

	const description = row['description']?.toString().trim() ?? '';
	if (description.length > 4000) errors.push(csvErrors.descriptionTooLong);

	const place = row['place']?.toString().trim() ?? '';
	if (place.length > 200) errors.push(csvErrors.placeTooLong);

	const externalUrl = row['externalUrl']?.toString().trim() ?? '';

	const { categories, error: catError } = normalizeCategories(row['categories']?.toString());
	if (catError) errors.push(catError);

	const { status, error: statusError } = normalizeStatus(row['status']?.toString(), externalUrl);
	if (statusError) errors.push(statusError);

	const trusteesOnly = normalizeBool(row['trusteesOnly']?.toString());
	const image = row['image']?.toString().trim() ?? '';

	if (errors.length > 0) return { parsed: null, errors };

	return {
		parsed: { externalId, name, description, place, categories, externalUrl, status, trusteesOnly, image },
		errors: [],
	};
}

export function parseCsv(csvText: string): {
	rows: Array<Record<string, string>>;
	error?: string;
} {
	const result = Papa.parse<Record<string, string>>(csvText, {
		header: true,
		skipEmptyLines: true,
		transformHeader: (h) => h.trim(),
	});

	if (result.errors.length > 0) {
		const fatalErrors = result.errors.filter((e) => e.type === 'Delimiter' || e.type === 'Quotes');
		if (fatalErrors.length > 0) {
			return { rows: [], error: csvErrors.parseFatal(fatalErrors[0].message) };
		}
	}

	return { rows: result.data };
}

export function validateFileLimits(text: string, rowCount: number): string | null {
	if (new TextEncoder().encode(text).length > MAX_FILE_SIZE_BYTES) {
		return texts.institutional.importFileTooLarge;
	}
	if (rowCount > MAX_ROWS) {
		return texts.institutional.importTooManyRows;
	}
	return null;
}

/** Converts a validated CSV row into a core `MappedItem` for the given owner. */
export function mapRowToItem(row: ParsedRow, ownerId: string): MappedItem {
	return {
		externalId: row.externalId,
		name: row.name,
		description: row.description,
		status: row.status,
		categories: row.categories,
		externalUrl: row.externalUrl,
		externalImgUrl: row.image,
		place: row.place,
		owner: ownerId,
		trusteesOnly: row.trusteesOnly,
	};
}

/**
 * Parses, validates, and maps an uploaded WINBIAP CSV into core `MappedItem`s.
 * Valid rows become `mappedRows` (with their source row number and any warnings);
 * invalid rows become `rowErrors`. Duplicate `externalId`s are deduplicated
 * keep-last, so each externalId maps to at most one row (carrying a warning).
 *
 * @param csvText - Raw CSV text.
 * @param ownerId - PocketBase id of the importing institution (becomes `item.owner`).
 */
export function parseAndMapCsv(csvText: string, ownerId: string): ParseAndMapResult {
	const { rows, error: parseError } = parseCsv(csvText);
	if (parseError) {
		return { mappedRows: [], rowErrors: [], totalRows: 0, parseError };
	}

	const mappedRows: MappedRow[] = [];
	const rowErrors: RowResult[] = [];
	// Keep-last dedupe: a duplicate externalId must yield exactly one MappedRow, otherwise a
	// first import would issue two creates for the same (owner, externalId) and fail the
	// whole write batch on the unique index.
	const rowByExternalId = new Map<string, MappedRow>();

	rows.forEach((raw, i) => {
		const rowIndex = i + 2; // +2: row 1 is the header, arrays are 0-based
		const { parsed, errors } = parseAndValidateRow(raw);

		if (errors.length > 0 || !parsed) {
			rowErrors.push({
				rowIndex,
				externalId: raw['externalId'] ?? '',
				name: raw['name'] ?? '',
				action: 'error',
				errors,
			});
			return;
		}

		const duplicateOf = rowByExternalId.get(parsed.externalId);
		const row: MappedRow = {
			rowIndex,
			item: mapRowToItem(parsed, ownerId),
			warnings: duplicateOf ? [csvErrors.duplicateExternalId] : [],
		};
		if (duplicateOf) {
			mappedRows[mappedRows.indexOf(duplicateOf)] = row;
		} else {
			mappedRows.push(row);
		}
		rowByExternalId.set(parsed.externalId, row);
	});

	return { mappedRows, rowErrors, totalRows: rows.length };
}
