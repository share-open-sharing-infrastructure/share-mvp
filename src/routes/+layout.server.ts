export const load = async (event) => {
	const currentUser = event.locals.user;

	let unreadNotificationCount = 0;
	if (currentUser) {
		try {
			const result = await event.locals.pb
				.collection('notifications')
				.getList(1, 1, { filter: `recipient="${currentUser.id}" && read=false` });
			unreadNotificationCount = result.totalItems;
		} catch {
			// notifications collection may not exist yet during setup
		}
	}

	return {
		currentUser,
		unreadNotificationCount,
	};
};
