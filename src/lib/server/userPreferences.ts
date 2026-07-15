import type PocketBase from 'pocketbase';
import type { UserPreferences, UserId } from '$lib/types/models';

// Central access point for the `user_preferences` sidecar collection (issue #426).
// One owner-only row per user (unique index on `user`) holds settings pulled off the
// `users` table — currently `emailNotifications`, `preferredTransportMode` and
// `hasOnboarded`. A missing row means "all defaults", so readers must tolerate null.
// NOTE: NotificationSettings.svelte reads/writes `emailNotifications` client-side; keep
// these writes field-scoped (never overwrite the whole row) so the two paths coexist.

/** The subset of preference fields callers may write. */
export type UserPreferencesPatch = Partial<
	Pick<UserPreferences, 'emailNotifications' | 'preferredTransportMode' | 'hasOnboarded'>
>;

/**
 * Returns the user's preferences row, or null if none has been created yet.
 *
 * `requestKey` MUST be distinct per concurrent call site on the same request. The root
 * layout load and a page load (item detail, profile) both fetch preferences and run
 * concurrently on the same `locals.pb`; PocketBase's default auto-cancellation keys by
 * method+path, so without distinct keys the second identical GET aborts the first and
 * one caller silently gets null (the same class of bug as the `/social` trust fetch —
 * see `trust.ts`). Pass a stable, call-site-specific key.
 */
export async function getUserPreferences(
	pb: PocketBase,
	userId: UserId,
	requestKey = 'user-preferences'
): Promise<UserPreferences | null> {
	try {
		return await pb
			.collection('user_preferences')
			.getFirstListItem<UserPreferences>(pb.filter('user = {:userId}', { userId }), { requestKey });
	} catch {
		// PocketBase throws 404 when no record matches — translate to null.
		return null;
	}
}

/**
 * Upserts the user's own preferences row, patching only the given fields. Creates it
 * on first save, updates it thereafter (one row per user, enforced by a unique index
 * on `user`). If two saves race and both try to create, the loser's unique-index error
 * is caught and retried as an update, so the user never sees a spurious failure.
 */
export async function upsertUserPreferences(
	pb: PocketBase,
	userId: UserId,
	patch: UserPreferencesPatch
): Promise<void> {
	const existing = await getUserPreferences(pb, userId);
	if (existing) {
		await pb.collection('user_preferences').update(existing.id, patch);
		return;
	}
	try {
		await pb.collection('user_preferences').create({ user: userId, ...patch });
	} catch (err) {
		// Lost a create race (unique index on user) — fall back to updating the row
		// that the other writer just created.
		const row = await getUserPreferences(pb, userId);
		if (row) await pb.collection('user_preferences').update(row.id, patch);
		else throw err;
	}
}
