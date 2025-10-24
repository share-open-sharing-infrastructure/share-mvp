import { fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import type { PageServerLoad } from './$types';
import { PB_URL } from '../../hooks.server';




export const load = (async ({ locals }) => {
    const items = await locals.pb.collection('items').getFullList();

    const uniquePlaces = Array.from(new Set(items.map(item => item.place)));
    const uniqueNames = Array.from(new Set(items.map(item => item.name)));

    if (!locals.pb.authStore.record) {
        return redirect(303, '/login')

    }
    return {
    items: structuredClone(items),
    PB_IMG_URL: PB_URL,
    uniqueNames: structuredClone(uniqueNames),
    uniquePlaces: structuredClone(uniquePlaces)



    
    };
}) satisfies PageServerLoad;

export const actions = {

}

