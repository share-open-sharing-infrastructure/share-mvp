import { NOTIFICATIONS_DEP } from '$lib/constants';
import { getUserPreferences } from '$lib/server/userPreferences';
import type { UserPreferences } from '$lib/types/models';

export const load = async (event) => {
	// Lets invalidate(NOTIFICATIONS_DEP) re-fetch just the unread count (issue #376).
	event.depends(NOTIFICATIONS_DEP);

	const currentUser = event.locals.user;

	let unreadNotificationCount = 0;
	// Preferences (transport mode, onboarding flag, …) live in a sidecar collection
	// (issue #426); surface them once here so every page can read them off `data`.
	let currentUserPreferences: UserPreferences | null = null;
	if (currentUser) {
		try {
			const result = await event.locals.pb
				.collection('notifications')
				.getList(1, 1, {
					filter: event.locals.pb.filter('recipient={:userId} && read=false', {
						userId: currentUser.id,
					}),
				});
			unreadNotificationCount = result.totalItems;
		} catch {
			// notifications collection may not exist yet during setup
		}
		currentUserPreferences = await getUserPreferences(
			event.locals.pb,
			currentUser.id,
			'user-preferences-layout'
		);
	}

	return {
		currentUser,
		currentUserPreferences,
		unreadNotificationCount,
		pbAuthToken: event.locals.pb.authStore.token ?? null,
	};
};
