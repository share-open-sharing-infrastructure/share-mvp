import { NOTIFICATIONS_DEP } from '$lib/constants';
import { getUserPreferences } from '$lib/server/userPreferences';
import { isAdmin } from '$lib/server/metrics';
import type { UserPreferences } from '$lib/types/models';

export const load = async (event) => {
	// Lets invalidate(NOTIFICATIONS_DEP) re-fetch just the unread count (issue #376).
	event.depends(NOTIFICATIONS_DEP);

	const currentUser = event.locals.user;

	let unreadNotificationCount = 0;
	// Preferences (transport mode, onboarding flag, …) live in a sidecar collection
	// (issue #426); surface them once here so every page can read them off `data`.
	let currentUserPreferences: UserPreferences | null = null;
	// isAdmin isn't on currentUser (the field is hidden on the backend — see
	// $lib/server/metrics.ts), so the nav's admin link needs its own lookup here.
	let isAdminUser = false;
	if (currentUser) {
		// Hoisted out of the Promise.all below to keep that call readable — inline, this read's
		// filter, requestKey and error handling bury the two sibling reads next to it. try/catch
		// rather than a trailing .catch, so it also covers the synchronous `pb.filter(...)` in the
		// arguments — the enclosing try covered that too, before these reads were parallelised.
		const unreadCountRead = (async () => {
			try {
				return await event.locals.pb.collection('notifications').getList(1, 1, {
					filter: event.locals.pb.filter('recipient={:userId} && read=false', {
						userId: currentUser.id,
					}),
					// Distinct requestKey, and load-bearing rather than precautionary: `/notifications`'s
					// page load lists the same collection and runs concurrently with this layout load on
					// the same `locals.pb`. The SDK keys auto-cancellation by method+path and ignores the
					// query string, so on a shared key the two abort each other at random — the badge
					// falls back to 0, or the list renders empty. Same trap as
					// $lib/server/userPreferences.ts and trust.ts.
					requestKey: 'notifications-unread-layout',
				});
			} catch {
				// notifications collection may not exist yet during setup
				return null;
			}
		})();

		// Independent reads, so they go out concurrently: one round trip instead of three
		// sequential ones on *every* authenticated SSR request. Safe together — the two
		// `locals.pb` reads use distinct requestKeys and isAdmin runs on the separate superuser
		// client, so the SDK's auto-cancellation can't have them cancel each other. Each read
		// keeps its own error handling: Promise.all rejects on the first rejection, so a
		// group-level catch would drop the other two reads with it.
		const [notificationList, preferences, adminFlag] = await Promise.all([
			unreadCountRead,
			getUserPreferences(
				event.locals.pb,
				currentUser.id,
				'user-preferences-layout'
			),
			isAdmin(currentUser.id),
		]);
		unreadNotificationCount = notificationList?.totalItems ?? 0;
		currentUserPreferences = preferences;
		isAdminUser = adminFlag;
	}

	return {
		currentUser,
		currentUserPreferences,
		unreadNotificationCount,
		isAdminUser,
		pbAuthToken: event.locals.pb.authStore.token ?? null,
	};
};
