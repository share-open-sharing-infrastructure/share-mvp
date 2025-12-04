export async function load({ locals }) {

    let friends;
    let users;

    try {
        users = await locals.pb.collection('users').getFullList()
        friends = users.filter(
            user => locals.user.trusts && locals.user.trusts.includes(user.id)
        );
    } catch (error) {
        console.error(error?.message || error);
    }

    return {
        users: users,
        friends: friends.map(friend => ({
            ...friend,
            profilePic: `https://ui-avatars.com/api/?name=${friend.username}&background=random`
        })) ?? []
    };

}

export const actions = {
    addFriend: async ({ request, locals }) => {
        // TODO: Implement adding a friend (not implemented yet)
        console.log("addFriend action called");
    },
    removeFriend: async ({ request, locals }) => {

    }
};

