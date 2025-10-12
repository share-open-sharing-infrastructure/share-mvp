import { fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import type { PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
    if (locals.pb.authStore.record) {
        return redirect(303, '/items')
    }

    return {
    };
}) satisfies PageServerLoad;

export const actions = {
    reset: async ({ locals, request }) => {
        const data = await request.formData();
        const email = data.get('email');

        if (!email) {
            return fail(400, { emailRequired: email === null });
        }

        try {
            await locals.pb.collection('users').requestPasswordReset(email.toString());
        } catch (error) {
            const errorObj = error as ClientResponseError;
            return fail(500, { fail: true, message: errorObj.data.message });
        }

        throw redirect(303, '/login');
    }
}
