import Papa from 'papaparse';
import { ITEM_CATEGORIES } from '$lib/texts';
import type { MappedItem } from '../core/types';

export type ImportStatus = 'available' | 'unavailable' | 'unknown';
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
	return { status: 'unknown', error: `Ungültiger status-Wert: "${raw}"` };
}

function normalizeCategories(raw: string | undefined): { categories: string[]; error?: string } {
	if (!raw || raw.trim() === '') return { categories: [] };
	const parts = raw
		.split(';')
		.map((s) => s.trim())
		.filter(Boolean);
	const invalid = parts.filter((p) => !(ITEM_CATEGORIES as readonly string[]).includes(p));
	if (invalid.length > 0) {
		return { categories: [], error: `Ungültige Kategorie(n): ${invalid.join(', ')}` };
	}
	if (parts.length > 3) {
		return { categories: parts.slice(0, 3), error: 'Maximal 3 Kategorien erlaubt (Rest ignoriert)' };
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
	if (!externalId) errors.push('externalId ist erforderlich');

	const name = row['name']?.toString().trim() ?? '';
	if (!name) errors.push('name ist erforderlich');
	if (name.length > 200) errors.push('name darf max. 200 Zeichen lang sein');

	const description = row['description']?.toString().trim() ?? '';
	if (description.length > 4000) errors.push('description darf max. 4.000 Zeichen lang sein');

	const place = row['place']?.toString().trim() ?? '';
	if (place.length > 200) errors.push('place darf max. 200 Zeichen lang sein');

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
			return { rows: [], error: `CSV-Fehler: ${fatalErrors[0].message}` };
		}
	}

	return { rows: result.data };
}

export function validateFileLimits(text: string, rowCount: number): string | null {
	if (new TextEncoder().encode(text).length > MAX_FILE_SIZE_BYTES) {
		return 'Die Datei ist zu groß (max. 1 MB).';
	}
	if (rowCount > MAX_ROWS) {
		return 'Zu viele Zeilen (max. 5.000).';
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
 * Valid rows become `mappedRows` (with their source row number and any warnings,
 * e.g. duplicate `externalId`); invalid rows become `rowErrors`.
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
	const seenExternalIds = new Set<string>();

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

		const warnings = seenExternalIds.has(parsed.externalId)
			? ['Doppelter externalId in der Datei – letzte Zeile gewinnt']
			: [];
		seenExternalIds.add(parsed.externalId);

		mappedRows.push({ rowIndex, item: mapRowToItem(parsed, ownerId), warnings });
	});

	return { mappedRows, rowErrors, totalRows: rows.length };
}
