import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
    if (locals.pb.authStore.record) { // Check if the user is authenticated
        locals.pb.authStore.clear(); // Clears the auth store, thereby effectively logs the user out
        return redirect(303, '/');
    }

    return {
    };
}) satisfies PageServerLoad;