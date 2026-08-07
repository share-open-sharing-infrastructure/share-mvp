import { describe, it, expect, vi, beforeEach } from 'vitest';

// Characterization tests for the bulk-add action (#470). They pin down today's
// behavior BEFORE the itemForm.ts extraction so the refactor is provably
// behavior-preserving. The single documented exception is the invalid-image-type
// row (see the test flagged "INTENTIONAL BEHAVIOR CHANGE"): the shared validator
// activates the MIME whitelist for bulk too, so such a row is now skipped.

const { getAttachableGroupsMock } = vi.hoisted(() => ({
	getAttachableGroupsMock: vi.fn(),
}));
vi.mock('$lib/server/groups', () => ({ getAttachableGroups: getAttachableGroupsMock }));

import { actions } from './+page.server';
import { texts } from '$lib/texts';

type BulkEvent = Parameters<typeof actions.bulkCreate>[0];

function imageFile(name = 'a.jpg', type = 'image/jpeg') {
	return new File(['x'], name, { type });
}

function buildPb() {
	const createMock = vi.fn().mockResolvedValue({});
	const pbClient = { collection: vi.fn(() => ({ create: createMock })) };
	return { pbClient, createMock };
}

/** Appends one bulk row (index i) to a FormData in the wire format ReviewStep emits. */
function appendRow(
	fd: FormData,
	i: number,
	row: {
		name?: string;
		description?: string;
		image?: File | null;
		categories?: string; // raw JSON string as sent over the wire
		groups?: string; // raw JSON string as sent over the wire
		trusteesOnly?: 'on' | 'off';
	}
) {
	if (row.name !== undefined) fd.set(`name_${i}`, row.name);
	if (row.description !== undefined) fd.set(`description_${i}`, row.description);
	if (row.image !== undefined && row.image !== null) fd.set(`image_${i}`, row.image);
	if (row.categories !== undefined) fd.set(`categories_${i}`, row.categories);
	if (row.groups !== undefined) fd.set(`groups_${i}`, row.groups);
	fd.set(`trusteesOnly_${i}`, row.trusteesOnly ?? 'off');
}

function runBulk(pbClient: unknown, fd: FormData) {
	return actions.bulkCreate({
		locals: { pb: pbClient, user: { id: 'u1' } },
		request: { formData: vi.fn().mockResolvedValue(fd) },
	} as unknown as BulkEvent);
}

/** redirect() throws; capture the thrown Redirect for assertions. */
async function runBulkCatchRedirect(pbClient: unknown, fd: FormData) {
	try {
		return { result: await runBulk(pbClient, fd), thrown: undefined as unknown };
	} catch (thrown) {
		return { result: undefined, thrown };
	}
}

describe('bulk-add: bulkCreate action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getAttachableGroupsMock.mockResolvedValue([]);
	});

	it('creates one item per valid row with the correct payload (happy path)', async () => {
		getAttachableGroupsMock.mockResolvedValue([{ id: 'g1' }, { id: 'g2' }]);
		const { pbClient, createMock } = buildPb();
		const fd = new FormData();
		fd.set('count', '2');
		appendRow(fd, 0, {
			name: 'Bohrer',
			description: 'Beschreibung 0',
			image: imageFile('0.jpg'),
			categories: JSON.stringify(['Werkzeug und Garten']),
			groups: JSON.stringify(['g1']),
			trusteesOnly: 'on',
		});
		appendRow(fd, 1, {
			name: 'Leiter',
			description: 'Beschreibung 1',
			image: imageFile('1.png', 'image/png'),
			categories: JSON.stringify(['Bücher']),
			groups: JSON.stringify(['g2']),
			trusteesOnly: 'off',
		});

		const { thrown } = await runBulkCatchRedirect(pbClient, fd);

		// success ⇒ redirect(303) is thrown
		expect((thrown as { status?: number }).status).toBe(303);
		expect(createMock).toHaveBeenCalledTimes(2);
		expect(createMock.mock.calls[0][0]).toMatchObject({
			name: 'Bohrer',
			description: 'Beschreibung 0',
			owner: 'u1',
			status: 'available',
			trusteesOnly: true,
			categories: ['Werkzeug und Garten'],
			groups: ['g1'],
		});
		expect(createMock.mock.calls[1][0]).toMatchObject({
			trusteesOnly: false,
			categories: ['Bücher'],
			groups: ['g2'],
		});
	});

	it('drops group ids the user may not attach (tampering guard)', async () => {
		getAttachableGroupsMock.mockResolvedValue([{ id: 'g1' }]);
		const { pbClient, createMock } = buildPb();
		const fd = new FormData();
		fd.set('count', '1');
		appendRow(fd, 0, {
			name: 'Ding',
			description: 'Beschreibung',
			image: imageFile(),
			groups: JSON.stringify(['g1', 'g-foreign']),
		});

		await runBulkCatchRedirect(pbClient, fd);

		expect(createMock.mock.calls[0][0].groups).toEqual(['g1']);
	});

	it('drops unknown categories', async () => {
		const { pbClient, createMock } = buildPb();
		const fd = new FormData();
		fd.set('count', '1');
		appendRow(fd, 0, {
			name: 'Ding',
			description: 'Beschreibung',
			image: imageFile(),
			categories: JSON.stringify(['Werkzeug und Garten', 'nonsense-cat']),
		});

		await runBulkCatchRedirect(pbClient, fd);

		expect(createMock.mock.calls[0][0].categories).toEqual(['Werkzeug und Garten']);
	});

	it('falls back to [] when categories/groups JSON is garbage, still creating the row', async () => {
		const { pbClient, createMock } = buildPb();
		const fd = new FormData();
		fd.set('count', '1');
		appendRow(fd, 0, {
			name: 'Ding',
			description: 'Beschreibung',
			image: imageFile(),
			categories: '{not json',
			groups: 'also not json',
		});

		await runBulkCatchRedirect(pbClient, fd);

		expect(createMock).toHaveBeenCalledTimes(1);
		expect(createMock.mock.calls[0][0].categories).toEqual([]);
		expect(createMock.mock.calls[0][0].groups).toEqual([]);
	});

	it('skips rows missing name, description, or file (and 0-byte files) but keeps valid rows', async () => {
		const { pbClient, createMock } = buildPb();
		const fd = new FormData();
		fd.set('count', '5');
		// 0: missing name
		appendRow(fd, 0, { description: 'd', image: imageFile() });
		// 1: missing description
		appendRow(fd, 1, { name: 'n', image: imageFile() });
		// 2: missing file
		appendRow(fd, 2, { name: 'n', description: 'd' });
		// 3: 0-byte file
		appendRow(fd, 3, { name: 'n', description: 'd', image: new File([], 'empty.jpg', { type: 'image/jpeg' }) });
		// 4: valid
		appendRow(fd, 4, { name: 'Gut', description: 'd', image: imageFile() });

		await runBulkCatchRedirect(pbClient, fd);

		expect(createMock).toHaveBeenCalledTimes(1);
		expect(createMock.mock.calls[0][0].name).toBe('Gut');
	});

	it('isolates a per-row create failure: logs it, keeps going, still redirects on ≥1 success', async () => {
		const { pbClient, createMock } = buildPb();
		createMock.mockRejectedValueOnce(new Error('boom'));
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const fd = new FormData();
		fd.set('count', '2');
		appendRow(fd, 0, { name: 'Fehlt', description: 'd', image: imageFile() });
		appendRow(fd, 1, { name: 'Klappt', description: 'd', image: imageFile() });

		const { thrown } = await runBulkCatchRedirect(pbClient, fd);

		expect(createMock).toHaveBeenCalledTimes(2);
		expect(errSpy).toHaveBeenCalled();
		expect((thrown as { status?: number }).status).toBe(303);
		errSpy.mockRestore();
	});

	it('fails with 500 when every row fails to create', async () => {
		const { pbClient, createMock } = buildPb();
		createMock.mockRejectedValue(new Error('boom'));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const fd = new FormData();
		fd.set('count', '1');
		appendRow(fd, 0, { name: 'Ding', description: 'd', image: imageFile() });

		const { result, thrown } = await runBulkCatchRedirect(pbClient, fd);

		expect(thrown).toBeUndefined();
		expect(result?.status).toBe(500);
		expect((result?.data as { message?: string }).message).toBe(texts.bulkUpload.uploadFailed);
	});

	it('redirects to /user/items on success', async () => {
		const { pbClient } = buildPb();
		const fd = new FormData();
		fd.set('count', '1');
		appendRow(fd, 0, { name: 'Ding', description: 'd', image: imageFile() });

		const { thrown } = await runBulkCatchRedirect(pbClient, fd);

		expect((thrown as { status?: number; location?: string }).status).toBe(303);
		expect((thrown as { location?: string }).location).toBe('/user/items');
	});

	it('fails with 400 when count is missing, zero, or negative', async () => {
		const { pbClient, createMock } = buildPb();
		for (const count of [undefined, '0', '-3']) {
			const fd = new FormData();
			if (count !== undefined) fd.set('count', count);
			const result = await runBulk(pbClient, fd);
			expect(result?.status).toBe(400);
		}
		expect(createMock).not.toHaveBeenCalled();
	});

	// INTENTIONAL BEHAVIOR CHANGE (#470, decided by the maintainer): the shared
	// validateItemFields applies the MIME whitelist to bulk rows too. A row whose
	// file is not an accepted image type is now treated as an invalid row and
	// skipped — exactly like a missing file — with no new error UI.
	// Pre-refactor this row WAS created (bulk had no MIME check). This is the one
	// documented deviation from strict "no behavior change".
	it('skips a row with an invalid image type (MIME whitelist now active in bulk)', async () => {
		const { pbClient, createMock } = buildPb();
		const fd = new FormData();
		fd.set('count', '2');
		appendRow(fd, 0, { name: 'PDF', description: 'd', image: imageFile('bad.pdf', 'application/pdf') });
		appendRow(fd, 1, { name: 'Gut', description: 'd', image: imageFile('ok.jpg') });

		await runBulkCatchRedirect(pbClient, fd);

		expect(createMock).toHaveBeenCalledTimes(1);
		expect(createMock.mock.calls[0][0].name).toBe('Gut');
	});
});
