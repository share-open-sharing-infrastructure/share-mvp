import { fail, redirect } from '@sveltejs/kit';
import { PB_URL } from '../../hooks.server';
import type { Item, UserId } from '$lib/types/models';

export async function load ({ locals }) {

    // Fetch all items from PocketBase
    const items: Item[] = await locals.pb
        .collection('items')
        .getFullList({
                expand: 'field', // expand the relation to the 'field' (user) collection
                sort: '-updated', // sort by update date descending
                filter: locals.user ? `field != "${locals.user.id}"` : undefined // exclude user's own items from search results (if logged in)
            });
    
    console.log("Plain: " + items);
    // Filter out items which the current user is not trusted with
    const filteredItems = filterTrustedItems(
        items, 
        locals.user ? locals.user.id : null,
        locals.pb.authStore.isValid // I am not entirely sure if it is necessary to pass this (because a null userId should be sufficient), but added just to be clean
    );
    console.log("Filtered: " + filteredItems);
    // Extract unique places and names for filtering options
    const uniquePlaces = Array.from(new Set(filteredItems.map(item => item.place))); // deduplicates places by creating a Set
    const uniqueNames = Array.from(new Set(filteredItems.map(item => item.name)));

    // Return data to the page
    return {
        items: filteredItems,
        PB_IMG_URL: PB_URL,
        uniqueNames: uniqueNames,
        uniquePlaces: uniquePlaces,
        userId: locals.user ? locals.user.id : null
    };
};

export const actions = {
    create: async ({ locals, request }) => {
        const data = await request.formData();
        const name = data.get('name');
        const description = data.get('description');
        const place = data.get('place');
        const image = data.get('image');
        data.append('field', locals.user.id);

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
            console.error(error?.message || error);
        }
        
        redirect(303, '/');
    }
};

/**
 * Filters out items that the present user is not trusted with
 * @param items an unfiltered list of items to be filtered
 * @param userId the id of the logged in user (if logged in), null otherwise
 * @param loggedIn whether a user is currently logged in
 * @returns an array of Item objects that the user is allowed to see based on trusteesOnly settings
 */
function filterTrustedItems(items: Item[], userId: UserId, loggedIn: boolean): Item[] {
    let trustedItems = items;

    trustedItems = items.filter(item => {
        
        // If item is not marked trusteesOnly, always show it
        if (!item.trusteesOnly) {
            return true;
        }
        
        // If no user is logged in, do not show any trusteesOnly items
        if (!loggedIn) {
            return false;
        }

        // Check if current user is a trustee of the item's owner
        const itemOwnerTrustees = item.expand?.field?.trusts || [];
        const isTrustee = userId ? itemOwnerTrustees.includes(userId) : false;

        return isTrustee;
    });

    return trustedItems;
}

