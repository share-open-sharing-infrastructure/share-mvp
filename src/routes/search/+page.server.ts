import { PB_URL } from '../../hooks.server';

export async function load ({ locals }) {

    // Prepare PocketBase query parameters. If user is logged in, filter out their own items.
    const pocketbaseQuery = {
        expand: 'owner',
        filter: locals.user ? `owner != "${locals.user.id}"` : undefined
    };

    const items = await locals.pb.collection('items').getFullList(pocketbaseQuery);

    // Filter items based on trusteesOnly
    const filteredItems = items.filter(item => {
        // If item is not marked trusteesOnly, always show it
        if (!item.trusteesOnly) {
            return true;
        }

        // Not logged in - can't see trustees-only items
        if (!locals.pb.authStore.isValid) {
            return false;
        }

        // Check if current user is a trustee of the item's owner
        const itemOwnerTrustees = item.expand?.owner?.trusts || [];
        const isTrustee = itemOwnerTrustees.includes(locals.user?.id);

        return isTrustee;
    });


    const uniquePlaces = Array.from(new Set(items.map(item => item.place))); // deduplicates places by creating a Set
    const uniqueNames = Array.from(new Set(items.map(item => item.name)));

    return {
        items: filteredItems,
        PB_IMG_URL: PB_URL,
        uniqueNames: structuredClone(uniqueNames),
        uniquePlaces: structuredClone(uniquePlaces),
        userId: locals.user ? locals.user.id : null
    };
};