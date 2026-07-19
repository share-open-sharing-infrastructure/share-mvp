import type PocketBase from 'pocketbase';
import { ITEM_CATEGORIES, type ItemCategory } from '$lib/categories';
import type { Item } from '$lib/types/models';
import { getAttachableGroups } from '$lib/server/groups';

/**
 * Shared server-side helpers for the two item-creation flows (single add/edit in
 * `user/items/+page.server.ts` and bulk add in `user/items/bulk-add/+page.server.ts`).
 * Extraction, validation and sanitization live here so a new item field only has to
 * be wired once. The wire formats of the two forms stay unchanged; only the logic
 * between "FormData in" and "PocketBase payload out" is shared.
 */

/**
 * Max images per item — mirrors the items.image maxSelect in the backend migration.
 * PocketBase rejects more, so guard here too (defends against a direct/tampered POST).
 * Change there ⇒ change here.
 */
export const MAX_ITEM_IMAGES = 5;

/** Accepted image MIME types for uploaded item photos. */
export const VALID_IMAGE_TYPES = [
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/svg+xml',
] as const;

/**
 * Typed write payload for items create/update — replaces the former
 * `Record<string, any>`. `image` is only set when new files were uploaded; on
 * update, omitting it keeps the existing images. `owner` is create-only, `place`
 * is single-flow-only (bulk has no place field).
 */
export interface ItemWritePayload {
	name: FormDataEntryValue | null;
	description: FormDataEntryValue | null;
	place?: FormDataEntryValue | null;
	trusteesOnly: boolean;
	groups: string[];
	status: Item['status'];
	categories: ItemCategory[];
	image?: File | File[];
	owner?: string;
}

/** Drop unknown categories — single source of truth for both flows. */
export function sanitizeCategories(raw: string[]): ItemCategory[] {
	return raw.filter((c): c is ItemCategory => ITEM_CATEGORIES.includes(c as ItemCategory));
}

/**
 * Keep only the submitted group ids the user may actually attach against a
 * pre-loaded allowed-id set. Split out so the bulk flow can load the attachable
 * set once per request (not once per row) and still share the filter.
 */
export function filterAttachableGroups(submitted: string[], allowedIds: Set<string>): string[] {
	return submitted.filter((id) => allowedIds.has(id));
}

/**
 * Keep only the submitted group ids the user is actually allowed to attach
 * (groups they own or are a member of), so a tampered form can't share an item
 * with arbitrary groups. Early-returns without a DB call on empty input.
 */
export async function sanitizeGroups(
	pb: PocketBase,
	userId: string,
	submitted: string[]
): Promise<string[]> {
	if (submitted.length === 0) return [];
	const allowed = new Set((await getAttachableGroups(pb, userId)).map((g) => g.id));
	return filterAttachableGroups(submitted, allowed);
}

/**
 * Validation error flags. **The key names are API**: `ItemModal.svelte` and the
 * item route tests key off them — do not rename.
 */
export interface ItemValidationErrors {
	nameIsMissing: boolean;
	descriptionIsMissing: boolean;
	imageIsMissing: boolean;
	imageInvalidType: boolean;
	tooManyImages: boolean;
}

/**
 * Validate the shared item fields. `requireImage` is true on create (an image is
 * mandatory) and false on update (a submit without new files keeps the existing
 * images). The MIME whitelist and image-count guards apply to whatever files are
 * present regardless.
 */
export function validateItemFields(
	input: {
		name: FormDataEntryValue | null;
		description: FormDataEntryValue | null;
		images: File[];
	},
	opts: { requireImage: boolean }
): { isValid: boolean; errors: ItemValidationErrors } {
	const errors: ItemValidationErrors = {
		nameIsMissing: !input.name,
		descriptionIsMissing: !input.description,
		imageIsMissing: opts.requireImage ? input.images.length === 0 : false,
		imageInvalidType: input.images.some(
			(img) => !VALID_IMAGE_TYPES.includes(img.type as (typeof VALID_IMAGE_TYPES)[number])
		),
		tooManyImages: input.images.length > MAX_ITEM_IMAGES,
	};

	return { isValid: Object.values(errors).every((e) => !e), errors };
}

/**
 * Extract the single add/edit form (field names `itemName`, `itemDescription`,
 * `itemPlace`, `itemImage` [multi-file], `categories`/`groups` [repeated],
 * `trusteesOnly`). Empty (0-byte) files — i.e. an untouched file input — are
 * filtered out so they count as "no new image".
 */
export function extractItemForm(data: FormData): {
	name: FormDataEntryValue | null;
	description: FormDataEntryValue | null;
	place: FormDataEntryValue | null;
	images: File[];
	rawCategories: string[];
	rawGroups: string[];
	trusteesOnly: boolean;
} {
	return {
		name: data.get('itemName'),
		description: data.get('itemDescription'),
		place: data.get('itemPlace'),
		images: data.getAll('itemImage').filter((f): f is File => f instanceof File && f.size > 0),
		rawCategories: data.getAll('categories').map(String),
		rawGroups: data.getAll('groups').map(String),
		trusteesOnly: data.get('trusteesOnly') === 'on',
	};
}

/** JSON-decode a bulk field to a string array, falling back to [] on garbage. */
function parseJsonStringArray(raw: FormDataEntryValue | null): string[] {
	try {
		const parsed = JSON.parse(typeof raw === 'string' ? raw : '[]');
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}

/**
 * Extract one bulk-add row (index `i`) from the wire format ReviewStep emits:
 * `name_${i}`, `description_${i}`, `image_${i}` (exactly one file),
 * `categories_${i}`/`groups_${i}` (JSON-encoded arrays), `trusteesOnly_${i}`.
 * A missing/non-File/0-byte `image_${i}` yields `null`.
 */
export function extractBulkItemDraft(
	data: FormData,
	i: number
): {
	name: string | null;
	description: string | null;
	image: File | null;
	rawCategories: string[];
	rawGroups: string[];
	trusteesOnly: boolean;
} {
	const name = data.get(`name_${i}`);
	const description = data.get(`description_${i}`);
	const image = data.get(`image_${i}`);
	return {
		name: typeof name === 'string' ? name : null,
		description: typeof description === 'string' ? description : null,
		image: image instanceof File && image.size > 0 ? image : null,
		rawCategories: parseJsonStringArray(data.get(`categories_${i}`)),
		rawGroups: parseJsonStringArray(data.get(`groups_${i}`)),
		trusteesOnly: data.get(`trusteesOnly_${i}`) === 'on',
	};
}
