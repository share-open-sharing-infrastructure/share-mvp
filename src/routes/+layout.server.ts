export const load = (event) => {
	return {
		currentUser: event.locals.user,
	};
};
