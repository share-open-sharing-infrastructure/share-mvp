import { redirect } from '@sveltejs/kit';

export function load ({ locals })  {
    if (locals.pb.authStore.record) { // Check if the user is authenticated
        locals.pb.authStore.clear(); // Clears the auth store, thereby effectively logs the user out
        redirect(303, '/');
    }
};