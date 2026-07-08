import { describe, it, expect, vi, beforeEach } from 'vitest';
import { texts } from '$lib/texts';

// Hermetic env: never depend on a local .env (absent in CI) — mock all required vars.
const { TEST_SECRET } = vi.hoisted(() => ({ TEST_SECRET: 'test-sync-secret' }));
vi.mock('$env/static/private', () => ({
	SYNC_SECRET: TEST_SECRET,
	PB_SUPERUSER_EMAIL: 'superuser@test.example',
	PB_SUPERUSER_PASSWORD: 'test-password',
}));

// DB-touching helpers are mocked; CSV parsing and diffing run for real (pure functions).
const { loadExistingItems } = vi.hoisted(() => ({ loadExistingItems: vi.fn() }));
const { applyDiff } = vi.hoisted(() => ({ applyDiff: vi.fn() }));
vi.mock('$lib/server/integrations/core/pocketbase', () => ({ loadExistingItems }));
vi.mock('$lib/server/integrations/core/write', () => ({ applyDiff }));

import { load, actions } from './+page.server';

const header = 'externalId,name,description,place,categories,externalUrl,status,trusteesOnly,image';

const institutionLocals = {
	user: { id: 'inst1', isInstitution: true },
	pb: {},
} as unknown as App.Locals;

const plainUserLocals = {
	user: { id: 'u1', isInstitution: false },
	pb: {},
} as unknown as App.Locals;

function previewEvent(locals: App.Locals, file: File | null) {
	const fd = new FormData();
	if (file) fd.set('csv', file);
	return {
		locals,
		request: { formData: vi.fn().mockResolvedValue(fd) },
	} as unknown as Parameters<typeof actions.preview>[0];
}

function applyEvent(locals: App.Locals, csvText: string | null) {
	const fd = new FormData();
	if (csvText !== null) fd.set('csvText', csvText);
	return {
		locals,
		request: { formData: vi.fn().mockResolvedValue(fd) },
	} as unknown as Parameters<typeof actions.apply>[0];
}

function csvFile(content: string, name = 'items.csv'): File {
	return new File([content], name, { type: 'text/csv' });
}

beforeEach(() => {
	vi.clearAllMocks();
	loadExistingItems.mockResolvedValue([]);
	applyDiff.mockResolvedValue({ created: 0, updated: 0, archived: 0, errors: [] });
});

describe('import: load', () => {
	it('403s for non-institutional accounts', async () => {
		await expect(
			load({ locals: plainUserLocals } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 403 });
	});

	it('passes for institutional accounts', async () => {
		await expect(
			load({ locals: institutionLocals } as unknown as Parameters<typeof load>[0])
		).resolves.toEqual({});
	});
});

describe('import: preview action', () => {
	it('fails 403 for non-institutional accounts before reading the form', async () => {
		const result = await actions.preview(previewEvent(plainUserLocals, csvFile('x')));
		expect(result).toMatchObject({ status: 403, data: { error: true } });
	});

	it('fails 400 when no file is uploaded', async () => {
		const result = await actions.preview(previewEvent(institutionLocals, null));
		expect(result).toMatchObject({ status: 400, data: { error: true } });
	});

	it('fails 400 with the xlsx hint for Excel files', async () => {
		const result = await actions.preview(
			previewEvent(institutionLocals, csvFile('binary', 'inventar.xlsx'))
		);
		expect(result).toMatchObject({
			status: 400,
			data: { message: texts.institutional.importXlsxError },
		});
	});

	it('fails 503 when the existing items cannot be loaded', async () => {
		loadExistingItems.mockRejectedValue(new Error('db down'));

		const result = await actions.preview(
			previewEvent(institutionLocals, csvFile(`${header}\nA-1,Bohrmaschine,,,,,,,`))
		);

		expect(result).toMatchObject({ status: 503, data: { error: true } });
	});

	it('fails 400 when the file exceeds the row limit', async () => {
		const rows = Array.from({ length: 5001 }, (_, i) => `A-${i},Item ${i},,,,,,,`);
		const result = await actions.preview(
			previewEvent(institutionLocals, csvFile([header, ...rows].join('\n')))
		);
		expect(result).toMatchObject({
			status: 400,
			data: { message: texts.institutional.importTooManyRows },
		});
	});

	it('derives per-row actions (create/update/skip) and archive rows, forcing the session owner', async () => {
		const unchanged = {
			id: 'pb-A-2',
			externalId: 'A-2',
			name: 'Leiter',
			description: '',
			status: 'available',
			categories: [],
			externalUrl: '',
			externalImgUrl: '',
			place: '',
		};
		loadExistingItems.mockResolvedValue([
			{ ...unchanged },
			{ ...unchanged, id: 'pb-A-3', externalId: 'A-3', name: 'Alter Name' },
			{ ...unchanged, id: 'pb-A-9', externalId: 'A-9', name: 'Verschwunden' },
		]);

		const csv = [
			header,
			'A-1,Bohrmaschine,,,,,,,', // new → create
			'A-2,Leiter,,,,,available,,', // unchanged → skip
			'A-3,Neuer Name,,,,,available,,', // changed → update
		].join('\n');

		const result = (await actions.preview(previewEvent(institutionLocals, csvFile(csv)))) as {
			preview: boolean;
			rowResults: Array<{ externalId: string; action: string }>;
			archiveRows: Array<{ externalId: string }>;
			summary: Record<string, number>;
		};

		// The owner comes from the session, never the request.
		expect(loadExistingItems).toHaveBeenCalledWith(institutionLocals.pb, 'inst1');
		expect(result.preview).toBe(true);
		const actionsById = Object.fromEntries(result.rowResults.map((r) => [r.externalId, r.action]));
		expect(actionsById).toEqual({ 'A-1': 'create', 'A-2': 'skip', 'A-3': 'update' });
		expect(result.archiveRows.map((r) => r.externalId)).toEqual(['A-9']);
		expect(result.summary).toMatchObject({ create: 1, update: 1, skip: 1, archive: 1, errors: 0 });
	});
});

describe('import: apply action', () => {
	it('fails 403 for non-institutional accounts', async () => {
		const result = await actions.apply(applyEvent(plainUserLocals, `${header}\nA-1,X,,,,,,,`));
		expect(result).toMatchObject({ status: 403, data: { error: true } });
	});

	it('fails 400 when no csvText is posted', async () => {
		const result = await actions.apply(applyEvent(institutionLocals, null));
		expect(result).toMatchObject({ status: 400, data: { error: true } });
	});

	it('applies the diff through the user-session client and reports the write summary', async () => {
		applyDiff.mockResolvedValue({ created: 1, updated: 0, archived: 0, errors: [] });

		const result = (await actions.apply(
			applyEvent(institutionLocals, `${header}\nA-1,Bohrmaschine,,,,,,,`)
		)) as { done: boolean; summary: Record<string, number> };

		// User-session pb client, no retry wrapper argument (never superuser re-auth).
		expect(applyDiff).toHaveBeenCalledTimes(1);
		expect(applyDiff.mock.calls[0][0]).toBe(institutionLocals.pb);
		const diff = applyDiff.mock.calls[0][1] as { toCreate: Array<{ owner: string }> };
		expect(diff.toCreate).toHaveLength(1);
		expect(diff.toCreate[0].owner).toBe('inst1'); // owner forced from the session
		expect(result.done).toBe(true);
		expect(result.summary).toMatchObject({ created: 1, errors: 0 });
	});
});

describe('import: refresh action', () => {
	function refreshEvent(locals: App.Locals, fetchImpl: typeof fetch) {
		return { locals, fetch: fetchImpl } as unknown as Parameters<typeof actions.refresh>[0];
	}

	it('fails 403 for non-institutional accounts without calling the endpoint', async () => {
		const fetchFn = vi.fn();
		const result = await actions.refresh(refreshEvent(plainUserLocals, fetchFn as never));

		expect(fetchFn).not.toHaveBeenCalled();
		expect(result).toMatchObject({ status: 403, data: { error: true } });
	});

	it('POSTs to /api/refresh for the session institution with the bearer secret', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: true });

		const result = await actions.refresh(refreshEvent(institutionLocals, fetchFn as never));

		expect(fetchFn).toHaveBeenCalledWith('/api/refresh?institution=inst1', {
			method: 'POST',
			headers: { authorization: `Bearer ${TEST_SECRET}` },
		});
		expect(result).toMatchObject({ refreshed: true });
	});

	it('fails 503 when the refresh endpoint reports an error', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 429 });

		const result = await actions.refresh(refreshEvent(institutionLocals, fetchFn as never));

		expect(result).toMatchObject({ status: 503, data: { error: true } });
	});

	it('fails 503 when the refresh call throws', async () => {
		const fetchFn = vi.fn().mockRejectedValue(new Error('network down'));

		const result = await actions.refresh(refreshEvent(institutionLocals, fetchFn as never));

		expect(result).toMatchObject({ status: 503, data: { error: true } });
	});
});
