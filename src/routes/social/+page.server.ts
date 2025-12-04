export async function load({ locals }) {

    // TODO: Load friends of the current user from the database (not implemented yet)

    // TODO: Either load all users on startup, or implement function to find users by name/email 

    return {
        message: "hello! Hier sollten deine Freunde sein."
    };

}

export const actions = {
    addFriend: async ({ request, locals }) => {
        // TODO: Implement adding a friend (not implemented yet)
        console.log("addFriend action called");
        
    }
};

