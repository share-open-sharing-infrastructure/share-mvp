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
        const formData = await request.formData();
        const name = formData.get('name');
        const description = formData.get('description');
        const place = formData.get('place');
        const image = formData.get('image');
        formData.append('field', locals.pb.authStore.record.id);

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
            await locals.pb.collection('items').create(formData)
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
        const image = formData.get('image');     

        if (!name || !description || !place ) {
            return fail(400, { 
                nameRequired: name === null, 
                descriptionRequired: description === null, 
                placeRequired: place === null 
            });
        }

        try {
            const updateData: Record<string, any> = {
                name: name,
                description: description,
                place: place
            };

            // Check if a new image was uploaded
            if (image && image instanceof File && image.size > 0) {
                updateData.image = image;
            }

            await locals.pb.collection('items').update(id, updateData);
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