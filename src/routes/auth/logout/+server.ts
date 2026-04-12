import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	locals.pb.authStore.clear();
	locals.user = null;

	// Redirect back to home
	return redirect(303, '/');
};
