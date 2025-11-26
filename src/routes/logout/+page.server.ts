import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
    default: async ({ locals }) => {
        // Clear PocketBase auth
        locals.pb.authStore.clear();

        // Redirect back to home
        redirect(308, '/');
    }
};