import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import { PB_URL } from '../../hooks.server';

export const load = (async ({ locals }) => {
    if (!locals.pb.authStore.record) {
        return redirect(303, '/login')
    }

    const items = await locals.pb.collection('items').getFullList();

    const uniquePlaces = Array.from(new Set(items.map(item => item.place))); // deduplicates places by creating a Set
    const uniqueNames = Array.from(new Set(items.map(item => item.name)));

    return {
        items: structuredClone(items),
        PB_IMG_URL: PB_URL,
        uniqueNames: structuredClone(uniqueNames),
        uniquePlaces: structuredClone(uniquePlaces)
    };
}) satisfies PageServerLoad;

export const actions = {

    create: async ({ locals, request }) => {
        const data = await request.formData();
        const name = data.get('name');
        const description = data.get('description');
        const place = data.get('place');
        const image = data.get('image');
        data.append('field', locals.pb.authStore.model.id);

        if (!name || !description || !place || !image ) {
            return fail(400, { nameRequired: name === null, descriptionRequired: description === null, placeRequired: place === null });
        }

        try {
            await locals.pb.collection('items').create(data)
            throw redirect(303, '/items');
        } catch (error) {
            console.log(error?.message || error);
        }
    }
} satisfies Actions;
