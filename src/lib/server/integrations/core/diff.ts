import { DESCRIPTION_PREFIX } from '$lib/server/itemArchive';
import type { DiffResult, ExistingItem, MappedItem } from './types';

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
 * Category comparison is order-independent via `sameCategories`.
 */
function hasChanged(existingRecord: ExistingItem, mappedItem: MappedItem): boolean {
	return (
		existingRecord.name !== mappedItem.name ||
		existingRecord.description !== mappedItem.description ||
		existingRecord.status !== mappedItem.status ||
		existingRecord.externalImgUrl !== mappedItem.externalImgUrl ||
		existingRecord.externalUrl !== mappedItem.externalUrl ||
		existingRecord.place !== mappedItem.place ||
		!sameCategories(existingRecord.categories, mappedItem.categories)
	);
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
		if (externalIdsInSource.has(record.externalId)) return false;
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
