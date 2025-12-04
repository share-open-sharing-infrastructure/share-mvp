export async function load({ locals }) {

    // TODO: Load friends of the current user from the database (not implemented yet)
    let friends = [
        { id: 1, username: 'Timo', profilePic: 'https://ui-avatars.com/api/?name=Timo&background=random'},
        { id: 2, username: 'Inga', profilePic: 'https://ui-avatars.com/api/?name=Inga&background=random'},
        { id: 3, username: 'Ingo', profilePic: 'https://ui-avatars.com/api/?name=Ingo&background=random'}
    ];

    // TODO: Either load all users on startup, or implement function to find users by name/email 
    let users = [];
    try {
        users = await locals.pb.collection('users').getFullList()
    } catch (error) {
        console.error(error?.message || error);
    }

    return {
        users: users,
        friends: friends
    };

}

export const actions = {
    addFriend: async ({ request, locals }) => {
        // TODO: Implement adding a friend (not implemented yet)
        console.log("addFriend action called");
        
    }
};

