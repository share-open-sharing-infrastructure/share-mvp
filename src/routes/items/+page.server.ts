import { fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import type { PageServerLoad } from './$types';
import { PB_URL } from '../../hooks.server';



export const load = (async ({ locals }) => {
    const items = await locals.pb.collection('items').getFullList();
    if (!locals.pb.authStore.record) {
        return redirect(303, '/login')

    }
    return {
    items: structuredClone(items),
    PB_IMG_URL: PB_URL


    
    };
}) satisfies PageServerLoad;


