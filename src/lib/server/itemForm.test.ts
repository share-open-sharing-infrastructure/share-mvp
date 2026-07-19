import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getAttachableGroupsMock } = vi.hoisted(() => ({ getAttachableGroupsMock: vi.fn() }));
vi.mock('$lib/server/groups', () => ({ getAttachableGroups: getAttachableGroupsMock }));

import {
	sanitizeCategories,
	sanitizeGroups,
	filterAttachableGroups,
	validateItemFields,
	extractItemForm,
	extractBulkItemDraft,
	MAX_ITEM_IMAGES,
} from './itemForm';

function imageFile(name = 'a.jpg', type = 'image/jpeg', body: BlobPart[] = ['x']) {
	return new File(body, name, { type });
}

describe('sanitizeCategories', () => {
	it('keeps known categories, drops unknown ones', () => {
		expect(sanitizeCategories(['Bücher', 'nonsense', 'Küche'])).toEqual(['Bücher', 'Küche']);
	});
	it('returns [] for empty input', () => {
		expect(sanitizeCategories([])).toEqual([]);
	});
});

describe('filterAttachableGroups', () => {
	it('keeps only ids in the allowed set', () => {
		expect(filterAttachableGroups(['g1', 'g2', 'g3'], new Set(['g1', 'g3']))).toEqual(['g1', 'g3']);
	});
});

describe('sanitizeGroups', () => {
	const pb = {} as unknown as Parameters<typeof sanitizeGroups>[0];
	beforeEach(() => vi.clearAllMocks());

	it('returns [] without a PB call on empty input', async () => {
		expect(await sanitizeGroups(pb, 'u1', [])).toEqual([]);
		expect(getAttachableGroupsMock).not.toHaveBeenCalled();
	});

	it('keeps only attachable groups', async () => {
		getAttachableGroupsMock.mockResolvedValue([{ id: 'g1' }, { id: 'g2' }]);
		expect(await sanitizeGroups(pb, 'u1', ['g1', 'g-foreign', 'g2'])).toEqual(['g1', 'g2']);
		expect(getAttachableGroupsMock).toHaveBeenCalledWith(pb, 'u1');
	});
});

describe('validateItemFields', () => {
	const ok = { name: 'Ding', description: 'Beschreibung', images: [imageFile()] };

	it('is valid when all fields are present and image types are accepted', () => {
		expect(validateItemFields(ok, { requireImage: true }).isValid).toBe(true);
	});

	it('flags a missing name', () => {
		const r = validateItemFields({ ...ok, name: '' }, { requireImage: true });
		expect(r.isValid).toBe(false);
		expect(r.errors.nameIsMissing).toBe(true);
	});

	it('flags a missing description', () => {
		const r = validateItemFields({ ...ok, description: null }, { requireImage: true });
		expect(r.errors.descriptionIsMissing).toBe(true);
	});

	it('flags a missing image only when requireImage is true', () => {
		expect(validateItemFields({ ...ok, images: [] }, { requireImage: true }).errors.imageIsMissing).toBe(true);
		expect(validateItemFields({ ...ok, images: [] }, { requireImage: false }).errors.imageIsMissing).toBe(false);
	});

	it('flags an invalid image type', () => {
		const r = validateItemFields(
			{ ...ok, images: [imageFile('bad.pdf', 'application/pdf')] },
			{ requireImage: true }
		);
		expect(r.errors.imageInvalidType).toBe(true);
	});

	it('accepts SVG', () => {
		const r = validateItemFields(
			{ ...ok, images: [imageFile('logo.svg', 'image/svg+xml', ['<svg></svg>'])] },
			{ requireImage: true }
		);
		expect(r.isValid).toBe(true);
	});

	it(`accepts exactly ${MAX_ITEM_IMAGES} images and rejects one more`, () => {
		const five = Array.from({ length: MAX_ITEM_IMAGES }, (_, i) => imageFile(`${i}.jpg`));
		expect(validateItemFields({ ...ok, images: five }, { requireImage: true }).errors.tooManyImages).toBe(false);
		expect(
			validateItemFields({ ...ok, images: [...five, imageFile('x.jpg')] }, { requireImage: true }).errors
				.tooManyImages
		).toBe(true);
	});
});

describe('extractItemForm', () => {
	it('collects multi-file images, filters 0-byte files, and maps trusteesOnly', () => {
		const fd = new FormData();
		fd.set('itemName', 'Ding');
		fd.set('itemDescription', 'Beschreibung');
		fd.set('itemPlace', 'Berlin');
		const a = imageFile('a.jpg');
		const b = imageFile('b.png', 'image/png');
		fd.append('itemImage', a);
		fd.append('itemImage', b);
		fd.append('itemImage', new File([], 'empty.jpg', { type: 'image/jpeg' }));
		fd.append('categories', 'Bücher');
		fd.append('groups', 'g1');
		fd.set('trusteesOnly', 'on');

		const out = extractItemForm(fd);

		expect(out.name).toBe('Ding');
		expect(out.description).toBe('Beschreibung');
		expect(out.place).toBe('Berlin');
		expect(out.images).toEqual([a, b]);
		expect(out.rawCategories).toEqual(['Bücher']);
		expect(out.rawGroups).toEqual(['g1']);
		expect(out.trusteesOnly).toBe(true);
	});

	it('returns nulls/empties for absent fields and trusteesOnly false', () => {
		const out = extractItemForm(new FormData());
		expect(out.name).toBeNull();
		expect(out.description).toBeNull();
		expect(out.place).toBeNull();
		expect(out.images).toEqual([]);
		expect(out.rawCategories).toEqual([]);
		expect(out.rawGroups).toEqual([]);
		expect(out.trusteesOnly).toBe(false);
	});
});

describe('extractBulkItemDraft', () => {
	it('reads indexed fields and JSON-decodes categories/groups', () => {
		const fd = new FormData();
		const img = imageFile('0.jpg');
		fd.set('name_0', 'Bohrer');
		fd.set('description_0', 'Beschreibung');
		fd.set('image_0', img);
		fd.set('categories_0', JSON.stringify(['Bücher']));
		fd.set('groups_0', JSON.stringify(['g1']));
		fd.set('trusteesOnly_0', 'on');

		const out = extractBulkItemDraft(fd, 0);

		expect(out.name).toBe('Bohrer');
		expect(out.description).toBe('Beschreibung');
		expect(out.image).toBe(img);
		expect(out.rawCategories).toEqual(['Bücher']);
		expect(out.rawGroups).toEqual(['g1']);
		expect(out.trusteesOnly).toBe(true);
	});

	it('falls back to [] on garbage JSON and null on a missing/0-byte file', () => {
		const fd = new FormData();
		fd.set('name_1', 'Ding');
		fd.set('description_1', 'd');
		fd.set('image_1', new File([], 'empty.jpg', { type: 'image/jpeg' }));
		fd.set('categories_1', '{not json');
		fd.set('groups_1', 'nope');

		const out = extractBulkItemDraft(fd, 1);

		expect(out.image).toBeNull();
		expect(out.rawCategories).toEqual([]);
		expect(out.rawGroups).toEqual([]);
	});

	it('returns null name/description when the indexed fields are absent', () => {
		const out = extractBulkItemDraft(new FormData(), 3);
		expect(out.name).toBeNull();
		expect(out.description).toBeNull();
		expect(out.image).toBeNull();
	});
});
