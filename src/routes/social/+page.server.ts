import { redirect } from '@sveltejs/kit';

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
        const formData = await request.formData()
        const friendId = formData.get('friendId');

        const updateData = {
            trusts: [...(locals.user.trusts || []), friendId]
        };

        try {
            const record = await locals.pb
                .collection('users')
                .update(locals.user.id, updateData);
        } catch (err) {
            console.error(err?.message || err);
        }
    },
    removeFriend: async ({ request, locals }) => {
        const formData = await request.formData()
        const friendId = formData.get('friendId');

        try {
            const updatedTrusts = (locals.user.trusts || []).filter(id => id !== friendId);
            const record = await locals.pb
                .collection('users')
                .update(locals.user.id, { trusts: updatedTrusts });
        } catch (err) {
            console.error(err?.message || err);
        }
    }
};

