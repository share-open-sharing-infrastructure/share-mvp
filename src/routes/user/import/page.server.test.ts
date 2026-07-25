import { describe, it, expect, vi, beforeEach } from 'vitest';
import { texts } from '$lib/texts';

// The apply/preview/refresh actions now delegate the DB work to the backend `/api/import/*`
// endpoints via `locals.pb.send`; CSV parsing + mapping still run for real (pure functions).
import { load, actions } from './+page.server';

const header = 'externalId,name,description,place,categories,externalUrl,status,trusteesOnly,image';

/** Builds a locals with a mockable `pb.send`. */
function makeLocals(isInstitution: boolean, send = vi.fn()) {
	return {
		user: isInstitution ? { id: 'inst1', isInstitution: true } : { id: 'u1', isInstitution: false },
		pb: { send }
	} as unknown as App.Locals;
}

function previewEvent(locals: App.Locals, file: File | null) {
	const fd = new FormData();
	if (file) fd.set('csv', file);
	return { locals, request: { formData: vi.fn().mockResolvedValue(fd) } } as unknown as Parameters<
		typeof actions.preview
	>[0];
}

function applyEvent(locals: App.Locals, csvText: string | null) {
	const fd = new FormData();
	if (csvText !== null) fd.set('csvText', csvText);
	return { locals, request: { formData: vi.fn().mockResolvedValue(fd) } } as unknown as Parameters<
		typeof actions.apply
	>[0];
}

function refreshEvent(locals: App.Locals) {
	return { locals } as unknown as Parameters<typeof actions.refresh>[0];
}

/** A PocketBase ClientResponseError-alike for the backend's 409 "another run is active". */
function busyError() {
	return Object.assign(new Error('busy'), { status: 409 });
}

function csvFile(content: string, name = 'items.csv'): File {
	return new File([content], name, { type: 'text/csv' });
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('import: load', () => {
	it('403s for non-institutional accounts', async () => {
		await expect(
			load({ locals: makeLocals(false) } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 403 });
	});

	it('passes for institutional accounts', async () => {
		await expect(
			load({ locals: makeLocals(true) } as unknown as Parameters<typeof load>[0])
		).resolves.toEqual({});
	});
});

describe('import: preview action', () => {
	it('fails 403 for non-institutional accounts before reading the form', async () => {
		const send = vi.fn();
		const result = await actions.preview(previewEvent(makeLocals(false, send), csvFile('x')));
		expect(result).toMatchObject({ status: 403, data: { error: true } });
		expect(send).not.toHaveBeenCalled();
	});

	it('fails 400 when no file is uploaded', async () => {
		const result = await actions.preview(previewEvent(makeLocals(true), null));
		expect(result).toMatchObject({ status: 400, data: { error: true } });
	});

	it('fails 400 with the xlsx hint for Excel files', async () => {
		const result = await actions.preview(previewEvent(makeLocals(true), csvFile('binary', 'inventar.xlsx')));
		expect(result).toMatchObject({ status: 400, data: { message: texts.institutional.importXlsxError } });
	});

	it('fails 400 when the file exceeds the row limit (before hitting the backend)', async () => {
		const send = vi.fn();
		const rows = Array.from({ length: 5001 }, (_, i) => `A-${i},Item ${i},,,,,,,`);
		const result = await actions.preview(
			previewEvent(makeLocals(true, send), csvFile([header, ...rows].join('\n')))
		);
		expect(result).toMatchObject({ status: 400, data: { message: texts.institutional.importTooManyRows } });
		expect(send).not.toHaveBeenCalled();
	});

	it('fails 503 when the backend preview call throws', async () => {
		const send = vi.fn().mockRejectedValue(new Error('backend down'));
		const result = await actions.preview(
			previewEvent(makeLocals(true, send), csvFile(`${header}\nA-1,Bohrmaschine,,,,,,,`))
		);
		expect(result).toMatchObject({ status: 503, data: { error: true } });
	});

	it('POSTs owner-less rows to /api/import/preview and maps the diff forecast onto the UI shape', async () => {
		const send = vi.fn().mockResolvedValue({
			summary: { create: 1, update: 1, archive: 1, skip: 0 },
			rowActions: [
				{ externalId: 'A-1', action: 'create' },
				{ externalId: 'A-3', action: 'update' }
			],
			archiveRows: [{ id: 'pb-A-9', externalId: 'A-9', name: 'Verschwunden' }]
		});

		const csv = [header, 'A-1,Bohrmaschine,,,,,,,', 'A-3,Neuer Name,,,,,available,,'].join('\n');
		const result = (await actions.preview(previewEvent(makeLocals(true, send), csvFile(csv)))) as {
			preview: boolean;
			rowResults: Array<{ externalId: string; action: string }>;
			archiveRows: Array<{ externalId: string }>;
			summary: Record<string, number>;
		};

		// Exactly one backend call, to the preview endpoint, with owner-less rows.
		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls[0][0]).toBe('/api/import/preview');
		const sentRows = send.mock.calls[0][1].body.rows as Array<Record<string, unknown>>;
		expect(sentRows).toHaveLength(2);
		expect(sentRows.every((r) => !('owner' in r))).toBe(true);
		expect(sentRows.map((r) => r.externalId)).toEqual(['A-1', 'A-3']);

		expect(result.preview).toBe(true);
		const actionsById = Object.fromEntries(result.rowResults.map((r) => [r.externalId, r.action]));
		expect(actionsById).toEqual({ 'A-1': 'create', 'A-3': 'update' });
		expect(result.archiveRows.map((r) => r.externalId)).toEqual(['A-9']);
		expect(result.summary).toMatchObject({ create: 1, update: 1, skip: 0, archive: 1, errors: 0 });
	});
});

describe('import: apply action', () => {
	it('fails 403 for non-institutional accounts', async () => {
		const send = vi.fn();
		const result = await actions.apply(applyEvent(makeLocals(false, send), `${header}\nA-1,X,,,,,,,`));
		expect(result).toMatchObject({ status: 403, data: { error: true } });
		expect(send).not.toHaveBeenCalled();
	});

	it('fails 400 when no csvText is posted', async () => {
		const result = await actions.apply(applyEvent(makeLocals(true), null));
		expect(result).toMatchObject({ status: 400, data: { error: true } });
	});

	it('POSTs owner-less rows to /api/import/apply and maps the summary', async () => {
		const send = vi.fn().mockResolvedValue({
			institution: 'inst1',
			fetched: 1,
			created: 1,
			updated: 0,
			archived: 0,
			skipped: 0,
			errors: [],
			durationMs: 5
		});

		const result = (await actions.apply(
			applyEvent(makeLocals(true, send), `${header}\nA-1,Bohrmaschine,,,,,,,`)
		)) as { done: boolean; summary: Record<string, number>; rowErrors: string[] };

		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls[0][0]).toBe('/api/import/apply');
		const sentRows = send.mock.calls[0][1].body.rows as Array<Record<string, unknown>>;
		expect(sentRows).toHaveLength(1);
		expect('owner' in sentRows[0]).toBe(false);
		expect(sentRows[0].externalId).toBe('A-1');

		expect(result.done).toBe(true);
		expect(result.summary).toMatchObject({ created: 1, errors: 0 });
	});

	it('folds backend write errors into the count and exposes them as rowErrors', async () => {
		const send = vi.fn().mockResolvedValue({
			institution: 'inst1',
			fetched: 1,
			created: 0,
			updated: 0,
			archived: 0,
			skipped: 0,
			errors: ['name: cannot be blank.'],
			durationMs: 5
		});
		const result = (await actions.apply(
			applyEvent(makeLocals(true, send), `${header}\nA-1,Bohrmaschine,,,,,,,`)
		)) as { summary: Record<string, number>; rowErrors: string[] };
		expect(result.summary.errors).toBe(1);
		expect(result.rowErrors).toEqual(['name: cannot be blank.']);
	});

	it('fails 409 with the busy text when another integration run holds the lock', async () => {
		const send = vi.fn().mockRejectedValue(busyError());
		const result = await actions.apply(applyEvent(makeLocals(true, send), `${header}\nx-1,Ding,,Stadt,,,available,false,`));
		expect(result).toMatchObject({
			status: 409,
			data: { error: true, message: texts.institutional.importBusy }
		});
	});

	it('fails 503 when the backend apply call throws', async () => {
		const send = vi.fn().mockRejectedValue(new Error('backend down'));
		const result = await actions.apply(applyEvent(makeLocals(true, send), `${header}\nA-1,Bohrmaschine,,,,,,,`));
		expect(result).toMatchObject({ status: 503, data: { error: true } });
	});
});

describe('import: refresh action', () => {
	it('fails 403 for non-institutional accounts without calling the endpoint', async () => {
		const send = vi.fn();
		const result = await actions.refresh(refreshEvent(makeLocals(false, send)));
		expect(send).not.toHaveBeenCalled();
		expect(result).toMatchObject({ status: 403, data: { error: true } });
	});

	it('POSTs to /api/import/refresh for the session institution', async () => {
		const send = vi.fn().mockResolvedValue({ institution: 'inst1', errors: [] });
		const result = await actions.refresh(refreshEvent(makeLocals(true, send)));
		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls[0][0]).toBe('/api/import/refresh');
		expect(send.mock.calls[0][1]).toMatchObject({ method: 'POST' });
		expect(result).toMatchObject({ refreshed: true });
	});

	it('fails 409 with the busy text when another integration run holds the lock', async () => {
		const send = vi.fn().mockRejectedValue(busyError());
		const result = await actions.refresh(refreshEvent(makeLocals(true, send)));
		expect(result).toMatchObject({
			status: 409,
			data: { error: true, message: texts.institutional.importBusy }
		});
	});

	it('reports the missing integration instead of a successful no-op', async () => {
		const send = vi.fn().mockResolvedValue({ institution: 'inst1', errors: [], configured: false });
		const result = await actions.refresh(refreshEvent(makeLocals(true, send)));
		expect(result).toMatchObject({
			status: 400,
			data: { error: true, message: texts.institutional.importRefreshNoIntegration }
		});
	});

	it('fails 503 when the refresh call throws', async () => {
		const send = vi.fn().mockRejectedValue(new Error('network down'));
		const result = await actions.refresh(refreshEvent(makeLocals(true, send)));
		expect(result).toMatchObject({ status: 503, data: { error: true } });
	});
});
