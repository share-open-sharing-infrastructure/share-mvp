import type PocketBase from 'pocketbase';
import { archiveDescription, pbErrorMessage } from '$lib/server/itemArchive';
import {
	noRetry,
	SYNCED_FIELDS,
	type DiffResult,
	type ExistingItem,
	type MappedItem,
	type RetryWrapper,
	type WriteResult,
} from './types';

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Projects a `MappedItem` to just the synced content fields for an update — deliberately
 * omitting `owner` (never changes) and `trusteesOnly` (institution/admin-curated). This lets a
 * status-only refresh touch only `status` without resetting `trusteesOnly`. Creates still write
 * the full item.
 */
function syncedFieldsOf(item: MappedItem): Pick<MappedItem, (typeof SYNCED_FIELDS)[number]> {
	return Object.fromEntries(SYNCED_FIELDS.map((field) => [field, item[field]])) as Pick<
		MappedItem,
		(typeof SYNCED_FIELDS)[number]
	>;
}

// Stays under PocketBase's default *:create rate limit of 20/5s.
const UPDATE_BATCH = 50;
const UPDATE_PAUSE_MS = 300;
const CREATE_BATCH = 15;
const CREATE_PAUSE_MS = 5500;

/**
 * Sends `items` to PocketBase in sequential batches, pausing between each batch.
 * Failed batches are recorded as errors without aborting the remaining batches.
 *
 * @param pb - PocketBase client.
 * @param items - All items to write in this pass.
 * @param batchSize - Maximum number of operations per PocketBase batch request.
 * @param interBatchPauseMs - Milliseconds to wait between consecutive batches (rate-limit compliance).
 * @param addToBatch - Callback that registers one item onto the batch (e.g. create or update).
 * @param retry - Wrapper applied to each batch send (e.g. superuser re-auth on 401); identity by default.
 * @returns `sent`: items in successful batches. `errors`: one raw error message per failed batch.
 */
async function sendBatched<T>(
	pb: PocketBase,
	items: T[],
	batchSize: number,
	interBatchPauseMs: number,
	addToBatch: (batch: ReturnType<typeof pb.createBatch>, item: T) => void,
	retry: RetryWrapper = noRetry,
): Promise<{ sent: number; errors: string[] }> {
	let sent = 0;
	const batchErrors: string[] = [];

	for (let offset = 0; offset < items.length; offset += batchSize) {
		const chunk = items.slice(offset, offset + batchSize);
		const batch = pb.createBatch();
		for (const item of chunk) {
			addToBatch(batch, item);
		}
		try {
			await retry(() => batch.send());
			sent += chunk.length;
		} catch (err) {
			batchErrors.push(pbErrorMessage(err));
		}
		if (offset + batchSize < items.length) await delay(interBatchPauseMs);
	}

	return { sent, errors: batchErrors };
}

/**
 * Applies a `DiffResult` to PocketBase via three batched write phases: updates, creates,
 * and archives. Failed batches are recorded as errors without aborting remaining phases.
 *
 * @param pb - PocketBase client (superuser for pull flows, user session for the import flow).
 * @param diff - Classified item lists from `diffItems`.
 * @param retry - Wrapper applied to each batch (superuser re-auth on 401); identity by default.
 * @returns Per-operation counts and any batch error messages (prefixed with the phase).
 */
export async function applyDiff(pb: PocketBase, diff: DiffResult, retry: RetryWrapper = noRetry): Promise<WriteResult> {
	const errors: string[] = [];

	const updateResult = await sendBatched(pb, diff.toUpdate, UPDATE_BATCH, UPDATE_PAUSE_MS,
		(batch, { id, data }) => batch.collection('items').update(id, syncedFieldsOf(data)), retry);
	errors.push(...updateResult.errors.map((e) => `update batch: ${e}`));

	const createResult = await sendBatched(pb, diff.toCreate, CREATE_BATCH, CREATE_PAUSE_MS,
		(batch, item) => batch.collection('items').create(item), retry);
	errors.push(...createResult.errors.map((e) => `create batch: ${e}`));

	const archiveResult = await sendBatched(pb, diff.toArchive, UPDATE_BATCH, UPDATE_PAUSE_MS,
		(batch, item: ExistingItem) => batch.collection('items').update(item.id, {
			status: 'unavailable',
			description: archiveDescription(item.description),
		}), retry);
	errors.push(...archiveResult.errors.map((e) => `archive batch: ${e}`));

	return {
		created: createResult.sent,
		updated: updateResult.sent,
		archived: archiveResult.sent,
		errors,
	};
}
