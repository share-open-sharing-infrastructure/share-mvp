import type { Item, UserId } from '$lib/types/models';

/**
 * Filters out items that the present user is not trusted with
 * @param items an unfiltered list of items to be filtered
 * @param userId the id of the logged in user (if logged in), null otherwise
 * @param loggedIn whether a user is currently logged in. I am not entirely sure if it is necessary to pass this (because a null userId should be sufficient), but added just to be clean
 * @returns an array of Item objects that the user is allowed to see based on trusteesOnly settings
 */
export function filterTrustedItems(items: Item[], userId: UserId | null, loggedIn: boolean): Item[] {
    return items.filter((item) => {
        if (!item.trusteesOnly) return true;
        if (!loggedIn) return false;
        
        const itemOwnerTrustees = item.expand?.owner?.trusts || [];
        return userId ? itemOwnerTrustees.includes(userId) : false;
    });
}