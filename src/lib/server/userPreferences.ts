import type PocketBase from 'pocketbase';
import type { UserPreferences, UserId } from '$lib/types/models';
import { upsertSingletonRow } from '$lib/server/singletonRow';

// Central access point for the `user_preferences` sidecar collection (issue #426).
// One owner-only row per user (unique index on `user`) holds settings pulled off the
// `users` table — currently `emailNotifications`, `digestEmails` (#607),
// `preferredTransportMode` and `hasOnboarded`. A missing row means "all defaults", so
// readers must tolerate null.
// NOTE: EmailNotificationForm.svelte (under the NotificationSettings.svelte wrapper) writes
// emailNotifications/digestEmails via the saveNotificationPrefs form action (also
// `upsertUserPreferences`, not a separate path) — keep these writes field-scoped (never
// overwrite the whole row) so other callers (preferredTransportMode from saveProfile,
// hasOnboarded from onboarding) coexist.

/** The subset of preference fields callers may write. */
export type UserPreferencesPatch = Partial<
	Pick<
		UserPreferences,
		'emailNotifications' | 'digestEmails' | 'preferredTransportMode' | 'hasOnboarded'
	>
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
 * on `user`); a lost create race is retried as an update by the shared helper.
 */
export async function upsertUserPreferences(
	pb: PocketBase,
	userId: UserId,
	patch: UserPreferencesPatch
): Promise<void> {
	await upsertSingletonRow({
		pb,
		collection: 'user_preferences',
		find: () => getUserPreferences(pb, userId),
		// #607 finding B2: PocketBase `bool` columns have no NULL state, so a row created
		// WITHOUT emailNotifications/digestEmails reads back as `false` for both — the
		// opposite of the documented default (missing row / true = opted in). The onboarding
		// call site (`upsertUserPreferences(pb, uid, { hasOnboarded: true })`) creates exactly
		// such a row today, silently opting every onboarded user out of ALL notification mail.
		// Explicitly default both to true here, before the caller's patch is spread on top, so
		// only an explicit `false` in the patch can opt a newly-created row out. Same trap this
		// migration already warns about: pb_migrations/1783600001_copy_transport_onboarded_to_prefs.js:33-38.
		createData: { user: userId, emailNotifications: true, digestEmails: true, ...patch },
		patch,
	});
}
