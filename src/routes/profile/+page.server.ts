import { fail, redirect } from '@sveltejs/kit';
import { PB_URL } from '../../hooks.server';

export async function load({ locals }) {
    const user = await locals.pb.collection('users').getOne(locals.pb.authStore.record.id, 
        {expand: 'items_via_field',} // expands the user "backwards" from the items collection, i.e. pulls all items related to this user
    );

    return {
        user: user,
        PB_URL: PB_URL
    };
}

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
            await locals.pb.collection('items').create(data)
        } catch (error) {
            console.error(error?.message || error);
        }

        redirect(303, '/profile');
    },

    update: async ({ locals, request }) => {
        const formData = await request.formData();

        const id = formData.get('itemId').toString();
        const name = formData.get('itemName');
        const description = formData.get('itemDescription');
        const place = formData.get('itemPlace');

        if (!name || !description || !place ) {
            return fail(400, { nameRequired: name === null, descriptionRequired: description === null, placeRequired: place === null });
        }

        try {
            await locals.pb.collection('items').update(id, {
                name: name,
                description: description,
                place: place
            });

        } catch (err) {
            console.error(err?.message || err);
        }
        redirect(303, '/profile');
    },

    delete: async ({ locals, request }) => {
        const formData = await request.formData();

        const id = formData.get('itemId').toString();
        try {
            await locals.pb.collection('items').delete(id);

        } catch (error) {
            console.error(error?.message || error);
        }
        redirect(303, '/profile');
    }
}