import {  redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';


export const load = (async ({ locals }) => {
    if (!locals.pb.authStore.record) {
            return redirect(303, '/login')
    }

    const records = await locals.pb.collection('messages').getFullList({
         filter: 'from = "uqszaef0c0r000q" || to = "uqszaef0c0r000q"',
    });
    
    return {
        records
    };
}) satisfies PageServerLoad;

export const actions = {

}

