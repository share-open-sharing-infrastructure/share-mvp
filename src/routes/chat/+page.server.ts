import {  redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';


export const load = (async ({ locals }) => {
    if (!locals.pb.authStore.record) {
            return redirect(303, '/login')
    }
    const userId = locals.pb.authStore.record.id;

    const records = await locals.pb.collection('messages').getFullList({
         filter: `from = "${userId}" || to = "${userId}"`,
    });
    
    return {
        records
    };
}) satisfies PageServerLoad;

export const actions = {

}

