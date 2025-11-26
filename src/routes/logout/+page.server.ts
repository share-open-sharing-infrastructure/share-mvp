import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
    default: async ({ locals, cookies }) => {
        // Clear PocketBase auth
        locals.pb.authStore.clear();

        cookies.set(
			'flash',
			JSON.stringify({
				type: 'success',
				message: 'Logged out succesfully'
			}),
			{
				path: '/',
				maxAge: 60 // seconds
			}
		);

        // Redirect back to home
        redirect(303, '/');
    }
};