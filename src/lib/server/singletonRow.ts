import type PocketBase from 'pocketbase';
import type { ClientResponseError } from 'pocketbase';

/**
 * Upsert for "one row per user/owner" sidecar collections (user_preferences,
 * user_contacts, user_geolocations, lending_requirements): update the existing row
 * if one matches, otherwise create it.
 *
 * Includes the create-race guard all callers need: if two saves race and both try
 * to create, the loser's unique-index error is caught and retried as an update, so
 * the user never sees a spurious failure from a double-submit. (Historically two of
 * the four call sites carried this fix and two didn't — keeping the idiom here means
 * the next sidecar collection gets it for free.)
 */
export async function upsertSingletonRow(opts: {
	pb: PocketBase;
	collection: string;
	/** Resolves the user's existing row (or null). Called again after a lost create race. */
	find: () => Promise<{ id: string } | null>;
	/** Full record data for first-time creation (must include the owning relation). */
	createData: Record<string, unknown>;
	/** Fields to patch when the row already exists. */
	patch: Record<string, unknown>;
}): Promise<void> {
	const { pb, collection, find, createData, patch } = opts;

	const existing = await find();
	if (existing) {
		await pb.collection(collection).update(existing.id, patch);
		return;
	}
	try {
		await pb.collection(collection).create(createData);
	} catch (err) {
		// Lost a create race (unique index on the owning relation) — fall back to
		// updating the row the other writer just created.
		const row = await find();
		if (row) await pb.collection(collection).update(row.id, patch);
		else throw err;
	}
}

/**
 * Clears the same "one row per user/owner" sidecar row: deletes it if one exists,
 * no-ops if there is nothing to delete.
 *
 * Counterpart to {@link upsertSingletonRow}, with the matching race guard on the way
 * out: two concurrent clears both resolve the same row id and both delete it, so the
 * loser gets a 404 for a row that is already in exactly the state it wanted. Like the
 * create guard, that race is settled by re-reading the state: a 404 is only swallowed
 * once `find` confirms the row is gone. Every other error throws.
 */
export async function deleteSingletonRow(opts: {
	pb: PocketBase;
	collection: string;
	/**
	 * Resolves the user's existing row, or null when there is nothing to delete. Called
	 * again after a 404 to confirm the row is really gone, so it must return null **only**
	 * for a genuine 404 and rethrow everything else — a `find` with a blanket
	 * `catch { return null }` would let a refused delete pass as done (#612).
	 */
	find: () => Promise<{ id: string } | null>;
}): Promise<void> {
	const { pb, collection, find } = opts;

	const existing = await find();
	if (!existing) return;

	try {
		await pb.collection(collection).delete(existing.id);
	} catch (err) {
		if ((err as Partial<ClientResponseError>)?.status !== 404) throw err;
		// Lost a delete race — but only if the row really is gone. If it survived, the
		// 404 came from a rule or hook refusing the delete, and that must not pass as done.
		if (await find()) throw err;
	}
}
