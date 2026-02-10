import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies }) => {
	locals.pb.authStore.clear(); // TODO: I think this might lead to a brief redirect to the login page bc the overall auth guard in hooks. Not horrible, but maybe can fix some time.
	locals.user = null;

	cookies.set(
		'flash',
		JSON.stringify({
			type: 'success',
			message: 'Logged out succesfully',
		}),
		{
			path: '/',
			maxAge: 60, // seconds
		}
	);

	// Redirect back to home
	return redirect(303, '/');
};
