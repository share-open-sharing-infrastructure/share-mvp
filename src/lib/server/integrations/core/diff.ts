import { DESCRIPTION_PREFIX } from '$lib/server/itemArchive';
import { SYNCED_FIELDS, type DiffResult, type ExistingItem, type MappedItem } from './types';

/**
 * Returns true if `left` and `right` contain the same category strings (order-independent).
 * Treats `undefined` as an empty array.
 */
function sameCategories(left: string[] | undefined, right: string[] | undefined): boolean {
	const sortedLeft = [...(left ?? [])].sort();
	const sortedRight = [...(right ?? [])].sort();
	return (
		sortedLeft.length === sortedRight.length &&
		sortedLeft.every((category, index) => category === sortedRight[index])
	);
}

/**
 * Returns true if any synced field on `existingRecord` differs from `mappedItem`.
 * Iterates `SYNCED_FIELDS` so the comparison stays in sync with the canonical field list;
 * `categories` is compared order-independently via `sameCategories`.
 */
function hasChanged(existingRecord: ExistingItem, mappedItem: MappedItem): boolean {
	return SYNCED_FIELDS.some((field) => {
		if (field === 'categories') {
			return !sameCategories(existingRecord.categories, mappedItem.categories);
		}
		return existingRecord[field] !== mappedItem[field];
	});
}

/**
 * Classifies `mappedItems` against `existingRecords` into four groups — items to create,
 * update, archive, or skip — without any I/O.
 *
 * An item is skipped if its fields are unchanged, or if it is already archived
 * (status `unavailable` + description prefixed by `DESCRIPTION_PREFIX`).
 *
 * @param mappedItems - Items freshly produced by an integration's source mapping.
 * @param existingRecords - Items currently stored in PocketBase for this institution.
 * @returns A `DiffResult` classifying every item into exactly one group.
 */
export function diffItems(mappedItems: MappedItem[], existingRecords: ExistingItem[]): DiffResult {
	const existingByExternalId = new Map(existingRecords.map((record) => [record.externalId, record]));
	const externalIdsInSource = new Set(mappedItems.map((item) => item.externalId));

	const toCreate: MappedItem[] = [];
	const toUpdate: Array<{ id: string; data: MappedItem }> = [];
	let skipped = 0;

	for (const mappedItem of mappedItems) {
		const existingRecord = existingByExternalId.get(mappedItem.externalId);
		if (!existingRecord) {
			toCreate.push(mappedItem);
		} else if (hasChanged(existingRecord, mappedItem)) {
			toUpdate.push({ id: existingRecord.id, data: mappedItem });
		} else {
			skipped += 1;
		}
	}

	const toArchive = existingRecords.filter((record) => {
		// loadExistingItems only returns records with a non-empty externalId; the guard
		// keeps the type honest against ExistingItem's optional key.
		if (record.externalId && externalIdsInSource.has(record.externalId)) return false;
		const alreadyArchived =
			record.status === 'unavailable' && record.description.startsWith(DESCRIPTION_PREFIX);
		if (alreadyArchived) {
			skipped += 1;
			return false;
		}
		return true;
	});

	return { toCreate, toUpdate, toArchive, skipped };
}
