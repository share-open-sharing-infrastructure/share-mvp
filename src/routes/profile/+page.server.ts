import { PB_URL } from '../../hooks.server';

export async function load({ locals }) {
    const user = await locals.pb.collection('users').getFirstListItem(`id="${locals.pb.authStore.record.id}"`, 
        {expand: 'items_via_field',} // expands the user "backwards" from the items collection, i.e. pulls all items related to this user
    );
    console.log(user);
    console.log(user.expand.items_via_field);

    return {
        user: user,
        PB_URL: PB_URL
    };
}