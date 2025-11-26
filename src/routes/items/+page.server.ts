import { fail, redirect } from '@sveltejs/kit';
import { PB_URL } from '../../hooks.server';

export async function load ({ locals }) {
    if (!locals.pb.authStore.record) {
        redirect(303, '/login')
    }

    const items = await locals.pb.collection('items').getFullList({
        expand: 'field'
    });

    const uniquePlaces = Array.from(new Set(items.map(item => item.place))); // deduplicates places by creating a Set
    const uniqueNames = Array.from(new Set(items.map(item => item.name)));

    return {
        items: structuredClone(items),
        PB_IMG_URL: PB_URL,
        uniqueNames: structuredClone(uniqueNames),
        uniquePlaces: structuredClone(uniquePlaces),
        userId: locals.pb.authStore.record.id
    };

};

export const actions = {
    create: async ({ locals, request }) => {
        const data = await request.formData();
        const name = data.get('name');
        const description = data.get('description');
        const place = data.get('place');
        const image = data.get('image');
        data.append('field', locals.pb.authStore.record.id);

        const noImage = !image || !(image instanceof File) || image.size === 0 || !image.name;

        if (!name || !description || !place || noImage ) {
            return fail(400, {
                fail: true,
                nameRequired:name === null, 
                descriptionRequired: description === null, 
                placeRequired: place === null,
                message: "Gegenstand konnte nicht hinzugefügt werden."
            });
        }

        try {
            await locals.pb.collection('items').create(data);
        } catch (error) {
            console.log(error?.message || error);
        }
        
        redirect(303, '/items');
    }
};
