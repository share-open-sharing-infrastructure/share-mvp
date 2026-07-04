import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { diffItems } from '../core/diff';
import {
	parseAndValidateRow,
	parseCsv,
	validateFileLimits,
	parseAndMapCsv,
} from './csv';

describe('parseAndValidateRow', () => {
	const baseRow = {
		externalId: 'ABC-001',
		name: 'Bohrmaschine',
		description: 'Eine Bohrmaschine',
		place: 'Lager',
		categories: 'Werkzeug und Garten',
		externalUrl: '',
		status: 'available',
		image: '',
		trusteesOnly: 'false',
	};

	it('accepts a valid row', () => {
		const { parsed, errors } = parseAndValidateRow(baseRow);
		expect(errors).toHaveLength(0);
		expect(parsed).not.toBeNull();
		expect(parsed!.externalId).toBe('ABC-001');
		expect(parsed!.name).toBe('Bohrmaschine');
		expect(parsed!.categories).toEqual(['Werkzeug und Garten']);
		expect(parsed!.status).toBe('available');
		expect(parsed!.trusteesOnly).toBe(false);
	});

	it('rejects a row missing externalId', () => {
		const { errors } = parseAndValidateRow({ ...baseRow, externalId: '' });
		expect(errors).toContain('externalId ist erforderlich');
	});

	it('rejects a row missing name', () => {
		const { errors } = parseAndValidateRow({ ...baseRow, name: '' });
		expect(errors).toContain('name ist erforderlich');
	});

	it('rejects an invalid category', () => {
		const { errors } = parseAndValidateRow({
			...baseRow,
			categories: 'Ungültig;Werkzeug und Garten',
		});
		expect(errors.some((e) => e.includes('Ungültige Kategorie'))).toBe(true);
	});

	it('accepts up to 3 valid categories separated by semicolons', () => {
		const { parsed, errors } = parseAndValidateRow({
			...baseRow,
			categories: 'Bücher;Spiele;Elektronik',
		});
		expect(errors).toHaveLength(0);
		expect(parsed!.categories).toEqual(['Bücher', 'Spiele', 'Elektronik']);
	});

	it('rejects an invalid status value', () => {
		const { errors } = parseAndValidateRow({ ...baseRow, status: 'maybe' });
		expect(errors.some((e) => e.includes('status'))).toBe(true);
	});

	it('accepts empty status and defaults to "available" when no externalUrl', () => {
		const { parsed, errors } = parseAndValidateRow({
			...baseRow,
			status: '',
			externalUrl: '',
		});
		expect(errors).toHaveLength(0);
		expect(parsed!.status).toBe('available');
	});

	it('defaults status to "unknown" when externalUrl is set and status is empty', () => {
		const { parsed, errors } = parseAndValidateRow({
			...baseRow,
			status: '',
			externalUrl: 'https://example.com/item/1',
		});
		expect(errors).toHaveLength(0);
		expect(parsed!.status).toBe('unknown');
	});

	it('defaults trusteesOnly to false when empty', () => {
		const { parsed } = parseAndValidateRow({ ...baseRow, trusteesOnly: '' });
		expect(parsed!.trusteesOnly).toBe(false);
	});

	it('sets trusteesOnly to true', () => {
		const { parsed } = parseAndValidateRow({
			...baseRow,
			trusteesOnly: 'true',
		});
		expect(parsed!.trusteesOnly).toBe(true);
	});
});

describe('parseCsv', () => {
	it('parses a well-formed CSV with header', () => {
		const csv = `externalId,name\nABC-001,Bohrmaschine\nABC-002,Leiter`;
		const { rows, error } = parseCsv(csv);
		expect(error).toBeUndefined();
		expect(rows).toHaveLength(2);
		expect(rows[0]['externalId']).toBe('ABC-001');
	});

	it('handles quoted fields with commas', () => {
		const csv = `externalId,name,description\nABC-001,"Bohrmachine, groß","Sehr gut, fast neu"`;
		const { rows } = parseCsv(csv);
		expect(rows[0]['name']).toBe('Bohrmachine, groß');
		expect(rows[0]['description']).toBe('Sehr gut, fast neu');
	});

	it('skips empty lines', () => {
		const csv = `externalId,name\nABC-001,Bohrmaschine\n\nABC-002,Leiter`;
		const { rows } = parseCsv(csv);
		expect(rows).toHaveLength(2);
	});
});

describe('validateFileLimits', () => {
	it('accepts a small file with few rows', () => {
		expect(validateFileLimits('a,b\n1,2', 1)).toBeNull();
	});

	it('rejects more than 5000 rows', () => {
		const msg = validateFileLimits('a', 5001);
		expect(msg).toContain('5.000');
	});

	it('rejects files over 1 MB', () => {
		const bigText = 'x'.repeat(1_000_001);
		const msg = validateFileLimits(bigText, 1);
		expect(msg).toContain('1 MB');
	});
});

describe('parseAndMapCsv', () => {
	const header =
		'externalId,name,description,place,categories,externalUrl,status,image,trusteesOnly';

	it('maps valid rows to core items owned by the institution', () => {
		const csv = `${header}\nABC-001,Bohrmaschine,Stark,Lager,Werkzeug und Garten,,available,https://img/1.jpg,false`;
		const { mappedRows, rowErrors, totalRows } = parseAndMapCsv(csv, 'inst1');

		expect(totalRows).toBe(1);
		expect(rowErrors).toHaveLength(0);
		expect(mappedRows).toHaveLength(1);
		expect(mappedRows[0].rowIndex).toBe(2);
		expect(mappedRows[0].item).toMatchObject({
			externalId: 'ABC-001',
			name: 'Bohrmaschine',
			owner: 'inst1',
			externalImgUrl: 'https://img/1.jpg', // image column → externalImgUrl
			categories: ['Werkzeug und Garten'],
		});
	});

	it('collects invalid rows as rowErrors with their source line number', () => {
		const csv = `${header}\n,Ohne ID,desc,,,,available,,false`;
		const { mappedRows, rowErrors } = parseAndMapCsv(csv, 'inst1');

		expect(mappedRows).toHaveLength(0);
		expect(rowErrors).toHaveLength(1);
		expect(rowErrors[0].rowIndex).toBe(2);
		expect(rowErrors[0].action).toBe('error');
		expect(rowErrors[0].errors.join(' ')).toContain('externalId');
	});

	it('dedupes duplicate externalIds keep-last, with a warning on the surviving row', () => {
		const csv = `${header}\nABC-001,Erste,,,,,,,\nABC-002,Andere,,,,,,,\nABC-001,Zweite,,,,,,,`;
		const { mappedRows } = parseAndMapCsv(csv, 'inst1');

		// Exactly one row per externalId — two creates for the same (owner, externalId)
		// would fail the whole write batch on the unique index.
		expect(mappedRows).toHaveLength(2);
		const survivor = mappedRows.find((r) => r.item.externalId === 'ABC-001');
		expect(survivor?.item.name).toBe('Zweite'); // letzte Zeile gewinnt
		expect(survivor?.rowIndex).toBe(4);
		expect(survivor?.warnings.join(' ')).toContain('Doppelter');
		expect(mappedRows.find((r) => r.item.externalId === 'ABC-002')?.warnings).toHaveLength(0);
	});

	it('a first-import diff of a file with duplicates yields a single create per externalId', () => {
		const csv = `${header}\nABC-001,Erste,,,,,,,\nABC-001,Zweite,,,,,,,`;
		const { mappedRows } = parseAndMapCsv(csv, 'inst1');

		const diff = diffItems(
			mappedRows.map((r) => r.item),
			[]
		);

		expect(diff.toCreate).toHaveLength(1);
		expect(diff.toCreate[0].name).toBe('Zweite');
	});

	it('returns no parseError for a clean file', () => {
		const csv = `${header}\nABC-001,Bohrmaschine,Stark,Lager,Werkzeug und Garten,,available,,false`;
		const { parseError } = parseAndMapCsv(csv, 'inst1');
		expect(parseError).toBeUndefined();
	});

	it('surfaces a fatal parse error and maps no rows for a malformed file', () => {
		const csv = `${header}\n"ABC-001,Bohrmaschine,Stark`;
		const { parseError, mappedRows } = parseAndMapCsv(csv, 'inst1');
		expect(parseError).toBeTruthy();
		expect(mappedRows).toHaveLength(0);
	});
});

// Guards the checked-in example file (docs/examples/import-test.csv) against drift —
// e.g. a renamed category or column would silently break the documented manual test.
describe('docs/examples/import-test.csv', () => {
	it('parses with exactly the intended errors and duplicate warning', () => {
		const csvText = readFileSync(
			join(__dirname, '../../../../../docs/examples/import-test.csv'),
			'utf-8'
		);
		const { mappedRows, rowErrors, totalRows, parseError } = parseAndMapCsv(
			csvText,
			'inst1'
		);

		expect(parseError).toBeUndefined();
		expect(totalRows).toBe(9);

		// Two intentionally invalid rows: missing name (ERR-001) and unknown category (ERR-002).
		expect(rowErrors.map((r) => r.externalId)).toEqual(['ERR-001', 'ERR-002']);
		expect(rowErrors[0].errors.join(' ')).toContain('name ist erforderlich');
		expect(rowErrors[1].errors.join(' ')).toContain('Ungültige Kategorie');

		// 7 valid rows, but the intentional duplicate of TEST-001 is deduplicated keep-last:
		// 6 mapped rows, with the surviving TEST-001 carrying the duplicate warning.
		expect(mappedRows).toHaveLength(6);
		const test1Rows = mappedRows.filter((r) => r.item.externalId === 'TEST-001');
		expect(test1Rows).toHaveLength(1);
		expect(test1Rows[0].warnings.join(' ')).toContain('Doppelter externalId');

		// Empty status + externalUrl set → 'unknown' (TEST-002).
		const tent = mappedRows.find((r) => r.item.externalId === 'TEST-002');
		expect(tent?.item.status).toBe('unknown');
		expect(tent?.item.categories).toEqual([
			'Reisen und Outdoor',
			'Freizeit und Sport',
		]);
	});
});
