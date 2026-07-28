import type PocketBase from 'pocketbase';

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
