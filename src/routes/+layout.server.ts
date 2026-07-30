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
		// Independent reads, so they go out concurrently: one round trip instead of three
		// sequential ones on *every* authenticated SSR request. Safe together — the two
		// `locals.pb` reads hit different paths and isAdmin runs on the separate superuser
		// client, so the SDK's path-keyed auto-cancellation can't have them cancel each
		// other. The catch stays per-promise: Promise.all rejects on the first rejection,
		// so a group-level catch would drop the other two reads with it.
		const [notificationList, preferences, adminFlag] = await Promise.all([
			event.locals.pb
				.collection('notifications')
				.getList(1, 1, {
					filter: event.locals.pb.filter('recipient={:userId} && read=false', {
						userId: currentUser.id,
					}),
					// Distinct requestKey per concurrent call site, per $lib/server/userPreferences.ts —
					// precautionary here (no other notifications read is concurrent with this one today).
					requestKey: 'notifications-unread-layout',
				})
				// notifications collection may not exist yet during setup
				.catch(() => null),
			getUserPreferences(event.locals.pb, currentUser.id, 'user-preferences-layout'),
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
