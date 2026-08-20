import { describe, it, expect, vi, beforeEach } from 'vitest';

// The delete action delegates the cascade + open-loan guard to deleteItem();
// that helper is unit-tested in src/lib/server/items.test.ts, so here we only
// assert the action delegates correctly and maps the result.
const { deleteItemMock, deleteMultipleItemsMock, setItemStatusMock, getAttachableGroupsMock } =
	vi.hoisted(() => ({
		deleteItemMock: vi.fn(),
		deleteMultipleItemsMock: vi.fn(),
		setItemStatusMock: vi.fn(),
		getAttachableGroupsMock: vi.fn(),
	}));
vi.mock('$lib/server/items', () => ({
	deleteItem: deleteItemMock,
	deleteMultipleItems: deleteMultipleItemsMock,
	setItemStatus: setItemStatusMock,
}));
// sanitizeGroups() calls getAttachableGroups; mock it so the group-filtering wiring is testable.
vi.mock('$lib/server/groups', () => ({ getAttachableGroups: getAttachableGroupsMock }));
// +page.server's load returns PB_URL from $lib/publicEnv's pbUrl(), which reads here.
vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_PB_URL: 'http://localhost', PUBLIC_VAPID_PUBLIC_KEY: 'x' },
}));

import { actions, load } from './+page.server';
import { texts } from '$lib/texts';
import { makeMockPb } from '$lib/test-utils/pocketbase';

// The actions return a union of fail() shapes (validation vs. save-error), so narrow the
// data to a permissive shape for assertions instead of indexing the union directly.
type FailData = { fail?: boolean; message?: string; missingFields?: Record<string, boolean> };
function failData(result: unknown): FailData {
	return (((result as { data?: unknown } | undefined)?.data ?? {}) as FailData) ?? {};
}

type DeleteEvent = Parameters<typeof actions.delete>[0];

const pb = {} as unknown;

function callDelete(itemId?: string) {
	const fd = new FormData();
	if (itemId !== undefined) fd.set('itemId', itemId);
	return actions.delete({
		locals: { pb, user: { id: 'u1' } },
		request: { formData: vi.fn().mockResolvedValue(fd) },
	} as unknown as DeleteEvent);
}

type LoadEvent = Parameters<typeof load>[0];

function buildLoadPb(getListImpl?: ReturnType<typeof vi.fn>) {
	const getList =
		getListImpl ?? vi.fn().mockResolvedValue({ items: [], totalItems: 0, totalPages: 0 });
	const loadPb = makeMockPb({
		users: { getOne: vi.fn().mockResolvedValue({ id: 'u1' }) },
		items: { getList },
	});
	getAttachableGroupsMock.mockResolvedValue([]);
	return { pb: loadPb, getList };
}

function callLoad(loadPb: unknown, search: string) {
	return load({
		locals: { pb: loadPb, user: { id: 'u1' } },
		url: new URL(`http://localhost/user/items${search}`),
	} as unknown as LoadEvent);
}

describe('user items: load', () => {
	beforeEach(() => vi.clearAllMocks());

	it('passes the ?search= query param through as data.search', async () => {
		const { pb: loadPb } = buildLoadPb();

		const result = await callLoad(loadPb, '?search=Bohrmaschine');

		expect(result.search).toBe('Bohrmaschine');
	});

	it('defaults data.search to an empty string when no ?search= param is present', async () => {
		const { pb: loadPb } = buildLoadPb();

		const result = await callLoad(loadPb, '');

		expect(result.search).toBe('');
	});

	it('builds the name filter via pb.filter with a name ~ {:search} placeholder', async () => {
		const { pb: loadPb, getList } = buildLoadPb();

		await callLoad(loadPb, '?search=Bohrmaschine');

		expect(loadPb.filter).toHaveBeenCalledWith('name ~ {:search}', { search: 'Bohrmaschine' });
		expect(getList).toHaveBeenCalledWith(
			1,
			25,
			expect.objectContaining({ filter: expect.stringContaining("name ~ 'Bohrmaschine'") })
		);
	});
});

describe('user items: delete action', () => {
	beforeEach(() => vi.clearAllMocks());

	it('delegates to deleteItem with the pb client, item id, and current user id', async () => {
		deleteItemMock.mockResolvedValue({ status: 'deleted' });

		const result = await callDelete('item1');

		expect(deleteItemMock).toHaveBeenCalledWith(pb, 'item1', 'u1');
		expect(result).toBeUndefined();
	});

	it('returns a 409 (with conversation ids) when the item has open conversations', async () => {
		deleteItemMock.mockResolvedValue({
			status: 'has_open_conversations',
			conversationIds: ['c1', 'c2'],
		});

		const result = await callDelete('item1');

		expect(result?.status).toBe(409);
		expect(result?.data).toMatchObject({
			fail: true,
			message: texts.pages.items.deleteBlockedByConversation,
			conversationIds: ['c1', 'c2'],
		});
	});

	it('does nothing when no itemId is supplied', async () => {
		const result = await callDelete(undefined);

		expect(deleteItemMock).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});

	it('swallows errors from deleteItem (resolves without throwing)', async () => {
		deleteItemMock.mockRejectedValueOnce(new Error('boom'));

		await expect(callDelete('item1')).resolves.toBeUndefined();
	});
});

// create/update accept a MULTI-file `image` field (#246): several photos per item.
type CreateEvent = Parameters<typeof actions.create>[0];
type UpdateEvent = Parameters<typeof actions.update>[0];

function imageFile(name: string, type = 'image/jpeg') {
	return new File(['x'], name, { type });
}

function buildPb() {
	const createMock = vi.fn().mockResolvedValue({});
	const updateMock = vi.fn().mockResolvedValue({});
	const pbClient = { collection: vi.fn(() => ({ create: createMock, update: updateMock })) };
	return { pbClient, createMock, updateMock };
}

function runCreate(pbClient: unknown, fd: FormData) {
	return actions.create({
		locals: { pb: pbClient, user: { id: 'u1' } },
		request: { formData: vi.fn().mockResolvedValue(fd) },
	} as unknown as CreateEvent);
}

function runUpdate(pbClient: unknown, fd: FormData) {
	return actions.update({
		locals: { pb: pbClient, user: { id: 'u1' } },
		request: { formData: vi.fn().mockResolvedValue(fd) },
	} as unknown as UpdateEvent);
}

describe('user items: create action (multi-image)', () => {
	it('passes every uploaded image as an array to items.create', async () => {
		const { pbClient, createMock } = buildPb();
		const fd = new FormData();
		fd.set('itemName', 'Bohrmaschine');
		fd.set('itemDescription', 'Eine gute Bohrmaschine');
		const a = imageFile('a.jpg');
		const b = imageFile('b.png', 'image/png');
		fd.append('itemImage', a);
		fd.append('itemImage', b);

		const result = await runCreate(pbClient, fd);

		expect(result).toBeUndefined();
		expect(createMock).toHaveBeenCalledTimes(1);
		expect(createMock.mock.calls[0][0].image).toEqual([a, b]);
	});

	it('fails when no image is uploaded (image required on create)', async () => {
		const { pbClient, createMock } = buildPb();
		const fd = new FormData();
		fd.set('itemName', 'Ding');
		fd.set('itemDescription', 'Beschreibung');

		const result = await runCreate(pbClient, fd);

		expect(result?.status).toBe(400);
		expect(failData(result).missingFields?.imageIsMissing).toBe(true);
		// The message the modal surfaces inline by the submit button (#522) — pin it down.
		expect(failData(result).message).toBe(texts.pages.items.validationFailed);
		expect(createMock).not.toHaveBeenCalled();
	});

	it('fails when any uploaded file is not an accepted image type', async () => {
		const { pbClient, createMock } = buildPb();
		const fd = new FormData();
		fd.set('itemName', 'Ding');
		fd.set('itemDescription', 'Beschreibung');
		fd.append('itemImage', imageFile('ok.jpg'));
		fd.append('itemImage', imageFile('bad.pdf', 'application/pdf'));

		const result = await runCreate(pbClient, fd);

		expect(result?.status).toBe(400);
		expect(failData(result).missingFields?.imageInvalidType).toBe(true);
		expect(createMock).not.toHaveBeenCalled();
	});
});

describe('user items: update action (multi-image)', () => {
	it('replaces images with the newly uploaded set', async () => {
		const { pbClient, updateMock } = buildPb();
		const fd = new FormData();
		fd.set('itemId', 'item1');
		fd.set('itemName', 'Ding');
		fd.set('itemDescription', 'Beschreibung');
		const a = imageFile('a.jpg');
		const b = imageFile('b.jpg');
		fd.append('itemImage', a);
		fd.append('itemImage', b);

		await runUpdate(pbClient, fd);

		expect(updateMock).toHaveBeenCalledTimes(1);
		expect(updateMock.mock.calls[0][0]).toBe('item1');
		expect(updateMock.mock.calls[0][1].image).toEqual([a, b]);
	});

	it('leaves the image field untouched when no new files are uploaded', async () => {
		const { pbClient, updateMock } = buildPb();
		const fd = new FormData();
		fd.set('itemId', 'item1');
		fd.set('itemName', 'Ding');
		fd.set('itemDescription', 'Beschreibung');

		await runUpdate(pbClient, fd);

		expect(updateMock).toHaveBeenCalledTimes(1);
		expect(updateMock.mock.calls[0][1]).not.toHaveProperty('image');
	});
});

describe('user items: create/update validation & guards', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects a create with no name', async () => {
		const { pbClient, createMock } = buildPb();
		const fd = new FormData();
		fd.set('itemDescription', 'Beschreibung');
		fd.append('itemImage', imageFile('a.jpg'));

		const result = await runCreate(pbClient, fd);

		expect(result?.status).toBe(400);
		expect(failData(result).missingFields?.nameIsMissing).toBe(true);
		expect(createMock).not.toHaveBeenCalled();
	});

	it('rejects a create with no description', async () => {
		const { pbClient, createMock } = buildPb();
		const fd = new FormData();
		fd.set('itemName', 'Ding');
		fd.append('itemImage', imageFile('a.jpg'));

		const result = await runCreate(pbClient, fd);

		expect(result?.status).toBe(400);
		expect(failData(result).missingFields?.descriptionIsMissing).toBe(true);
		expect(createMock).not.toHaveBeenCalled();
	});

	it('rejects a create with more than 5 images', async () => {
		const { pbClient, createMock } = buildPb();
		const fd = new FormData();
		fd.set('itemName', 'Ding');
		fd.set('itemDescription', 'Beschreibung');
		for (let i = 0; i < 6; i++) fd.append('itemImage', imageFile(`img${i}.jpg`));

		const result = await runCreate(pbClient, fd);

		expect(result?.status).toBe(400);
		expect(failData(result).missingFields?.tooManyImages).toBe(true);
		expect(createMock).not.toHaveBeenCalled();
	});

	it('accepts an SVG upload (svg is an allowed image type)', async () => {
		const { pbClient, createMock } = buildPb();
		const fd = new FormData();
		fd.set('itemName', 'Logo');
		fd.set('itemDescription', 'Ein SVG');
		fd.append('itemImage', new File(['<svg></svg>'], 'logo.svg', { type: 'image/svg+xml' }));

		const result = await runCreate(pbClient, fd);

		expect(result).toBeUndefined();
		expect(createMock).toHaveBeenCalledTimes(1);
	});

	it('rejects an invalid update (missing name) without calling pb.update', async () => {
		const { pbClient, updateMock } = buildPb();
		const fd = new FormData();
		fd.set('itemId', 'item1');
		fd.set('itemDescription', 'Beschreibung');

		const result = await runUpdate(pbClient, fd);

		expect(result?.status).toBe(400);
		expect(failData(result).missingFields?.nameIsMissing).toBe(true);
		expect(failData(result).message).toBe(texts.pages.items.validationFailed);
		expect(updateMock).not.toHaveBeenCalled();
	});

	it('ignores an empty (0-byte) file on update so existing images are kept', async () => {
		const { pbClient, updateMock } = buildPb();
		const fd = new FormData();
		fd.set('itemId', 'item1');
		fd.set('itemName', 'Ding');
		fd.set('itemDescription', 'Beschreibung');
		fd.append('itemImage', new File([], 'empty.png', { type: 'image/png' }));

		await runUpdate(pbClient, fd);

		expect(updateMock).toHaveBeenCalledTimes(1);
		expect(updateMock.mock.calls[0][1]).not.toHaveProperty('image');
	});

	it('only saves the groups the user may attach (sanitizeGroups filtering)', async () => {
		const { pbClient, createMock } = buildPb();
		// getAttachableGroups returns the allowed set; g3 is not in it and must be dropped.
		getAttachableGroupsMock.mockResolvedValue([{ id: 'g1' }, { id: 'g2' }]);
		const fd = new FormData();
		fd.set('itemName', 'Ding');
		fd.set('itemDescription', 'Beschreibung');
		fd.append('itemImage', imageFile('a.jpg'));
		fd.append('groups', 'g1');
		fd.append('groups', 'g3');

		await runCreate(pbClient, fd);

		expect(createMock).toHaveBeenCalledTimes(1);
		expect(createMock.mock.calls[0][0].groups).toEqual(['g1']);
	});

	it('surfaces a create failure as a 400/500 instead of a silent success', async () => {
		const { pbClient, createMock } = buildPb();
		createMock.mockRejectedValueOnce(new Error('maxSelect exceeded'));
		const fd = new FormData();
		fd.set('itemName', 'Ding');
		fd.set('itemDescription', 'Beschreibung');
		fd.append('itemImage', imageFile('a.jpg'));

		const result = await runCreate(pbClient, fd);

		expect(result?.status).toBe(500);
		expect(failData(result).fail).toBe(true);
		expect(failData(result).message).toBe(texts.pages.items.saveFailed);
	});
});
