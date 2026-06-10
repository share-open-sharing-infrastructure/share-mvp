export const load = async (event) => {
	const currentUser = event.locals.user;

	let unreadNotificationCount = 0;
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
	}

	return {
		currentUser,
		unreadNotificationCount,
		pbAuthToken: event.locals.pb.authStore.token ?? null,
	};
};
