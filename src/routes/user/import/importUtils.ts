import Papa from 'papaparse';
import { ITEM_CATEGORIES } from '$lib/texts';

export type ImportStatus = 'available' | 'unavailable' | 'unknown';
export type RowAction = 'create' | 'update' | 'skip' | 'archive';

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

export interface RowResult {
	rowIndex: number;
	externalId: string;
	name: string;
	action: RowAction | 'error';
	errors: string[];
	data?: ParsedRow;
}

export interface ArchiveRow {
	id: string;
	externalId: string;
	name: string;
	action: 'archive';
}

export interface PreviewSummary {
	create: number;
	update: number;
	archive: number;
	skip: number;
	errors: number;
}

const MAX_FILE_SIZE_BYTES = 1_000_000;
const MAX_ROWS = 5_000;

function normalizeStatus(raw: string | undefined, externalUrl: string): ImportStatus {
	if (!raw || raw.trim() === '') {
		return externalUrl ? 'unknown' : 'available';
	}
	const s = raw.trim().toLowerCase();
	if (s === 'available') return 'available';
	if (s === 'unavailable') return 'unavailable';
	if (s === 'unknown') return 'unknown';
	return null as unknown as ImportStatus; // signals validation error
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

	const rawStatus = row['status']?.toString();
	const status = normalizeStatus(rawStatus, externalUrl);
	if (status === null) errors.push(`Ungültiger status-Wert: "${rawStatus}"`);

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

export function validateFileLimits(
	text: string,
	rowCount: number
): string | null {
	if (new TextEncoder().encode(text).length > MAX_FILE_SIZE_BYTES) {
		return 'Die Datei ist zu groß (max. 1 MB).';
	}
	if (rowCount > MAX_ROWS) {
		return 'Zu viele Zeilen (max. 5.000).';
	}
	return null;
}

export function buildPreviewRows(
	parsedRows: ParsedRow[],
	existingExternalIds: Set<string>,
	seenInFile: Set<string>
): RowResult[] {
	return parsedRows.map((row, i) => {
		const isDuplicate = seenInFile.has(row.externalId);
		const action = existingExternalIds.has(row.externalId) ? 'update' : 'create';
		const warnings = isDuplicate ? ['Doppelter externalId in der Datei – letzte Zeile gewinnt'] : [];
		return {
			rowIndex: i + 2, // +2 because row 1 is header, and arrays are 0-based
			externalId: row.externalId,
			name: row.name,
			action,
			errors: warnings,
			data: row,
		};
	});
}
