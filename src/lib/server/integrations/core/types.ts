import type PocketBase from 'pocketbase';
import { type Item } from '$lib/types/models';

/**
 * Canonical list of the item fields an integration syncs. Single source of truth: the
 * change-detection comparison (`diffItems`) and the PocketBase field projection
 * (`loadExistingItems`) are both derived from this array, so adding a synced field here
 * is enough — there is no second place to keep in lockstep. See docs/integrations.md.
 */
export const SYNCED_FIELDS = [
	'name',
	'description',
	'status',
	'categories',
	'externalUrl',
	'externalImgUrl',
	'place',
] as const;

export type SyncedField = (typeof SYNCED_FIELDS)[number];

/**
 * The fields an integration produces for one item. A subset of the full `Item` type —
 * everything an ingestion source must supply for the generic upsert core to write it.
 * `externalId` is the upsert key: required and unique per owner (overrides `Item`'s
 * optional field); see docs/integrations.md.
 */
export type MappedItem = Pick<
	Item,
	SyncedField | 'owner' | 'trusteesOnly'
> & { externalId: string };

/** Subset of `items` fields loaded from PocketBase for change detection and archive decisions. */
export type ExistingItem = Pick<Item, SyncedField | 'id' | 'externalId'>;

/**
 * Generic, integration-agnostic description of an item owner.
 * Concrete integrations extend this with their own config fields (e.g. a base URL).
 */
export interface Institution {
	id: string;
	username: string;
	city?: string;
}

/** Per-sync counts and errors returned for one institution (or one error context). */
export interface SyncSummary {
	institution: string;
	fetched: number;
	created: number;
	updated: number;
	archived: number;
	skipped: number;
	errors: string[];
	durationMs: number;
}

/** Classification of mapped items vs. existing DB records, ready for batched writes. */
export interface DiffResult {
	/** Items with no matching `externalId` in the DB — to be created. */
	toCreate: MappedItem[];
	/** Items whose mapped fields differ from the stored record — to be updated. */
	toUpdate: Array<{ id: string; data: MappedItem }>;
	/** Existing DB items absent from the source and not yet archived — to be archived. */
	toArchive: ExistingItem[];
	/** Number of items that needed no write (unchanged or already archived). */
	skipped: number;
}

/** Per-operation counts and errors returned by a batched write pass. */
export interface WriteResult {
	created: number;
	updated: number;
	archived: number;
	errors: string[];
}

/**
 * Wraps a PocketBase operation, optionally adding retry/re-auth behavior. Defaults to
 * an identity wrapper (just runs the op). Scheduled-pull integrations inject one that
 * re-authenticates as superuser on a 401; user-session flows leave it as identity.
 */
export type RetryWrapper = <T>(op: () => Promise<T>) => Promise<T>;

/** Identity `RetryWrapper`: runs the operation with no retry. */
export const noRetry: RetryWrapper = (op) => op();

/**
 * Registry-facing contract for a scheduled-pull integration. Each implementation
 * discovers its own institutions and syncs them; the institution type stays internal
 * to the implementation, so heterogeneous integrations share one registry array.
 */
export interface PullIntegration {
	/** Stable identifier, e.g. 'leihbackend'. */
	readonly id: string;
	/** Discovers this integration's institutions and syncs each, isolating per-institution failures. */
	syncAll(pb: PocketBase): Promise<SyncSummary[]>;
}
