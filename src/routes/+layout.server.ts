export const load = (event) => {
	const flashCookie = event.cookies.get('flash');
	let flash = null;

	if (flashCookie) {
		try {
			flash = JSON.parse(flashCookie);
		} catch (error) {
			console.error('Failed to parse flash cookie:', error);
		}
		event.cookies.delete('flash', { path: '/' });
	}

	return {
		flash,
		currentUser: event.locals.user,
	};
};
