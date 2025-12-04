<script lang="ts">
	import { Button } from 'flowbite-svelte';

    const { data } = $props();

    let users = [
        { id: 1, userName: 'Timo', profilePic: 'https://ui-avatars.com/api/?name=Timo&background=random'},
        { id: 2, userName: 'Inga', profilePic: 'https://ui-avatars.com/api/?name=Inga&background=random'},
        { id: 3, userName: 'Ingo', profilePic: 'https://ui-avatars.com/api/?name=Ingo&background=random'},
        { id: 4, userName: 'Anna', profilePic: 'https://ui-avatars.com/api/?name=Anna&background=random'},
        { id: 5, userName: 'Lena', profilePic: 'https://ui-avatars.com/api/?name=Lena&background=random'},
        { id: 6, userName: 'Max', profilePic: 'https://ui-avatars.com/api/?name=Max&background=random'},
        { id: 7, userName: 'Sophie', profilePic: 'https://ui-avatars.com/api/?name=Sophie&background=random'},
        { id: 8, userName: 'Paul', profilePic: 'https://ui-avatars.com/api/?name=Paul&background=random'},
        { id: 9, userName: 'Laura', profilePic: 'https://ui-avatars.com/api/?name=Laura&background=random'},
        { id: 10, userName: 'Jan', profilePic: 'https://ui-avatars.com/api/?name=Jan&background=random'}
    ];

    let friends = $state([
        { id: 1, userName: 'Timo', profilePic: 'https://ui-avatars.com/api/?name=Timo&background=random'},
        { id: 2, userName: 'Inga', profilePic: 'https://ui-avatars.com/api/?name=Inga&background=random'},
        { id: 3, userName: 'Ingo', profilePic: 'https://ui-avatars.com/api/?name=Ingo&background=random'}
    ]);

    let userNameToBeAdded: string = $state('');
    let showDropdown: boolean = $state(false);

    // Filter users based on input and exclude already added friends
    let filteredUsers = $derived(
        userNameToBeAdded.length > 1 // only start filtering after 2 characters typed
            ? users.filter(user => 
                user.userName.toLowerCase().includes(userNameToBeAdded.toLowerCase()) &&
                !friends.some(friend => friend.id === user.id)
            )
            : []
    );

    function addFriend(friendName: string) {
        friends.push({
            id: friends.length + 1,
            userName: friendName,
            profilePic: `https://ui-avatars.com/api/?name=${friendName}&background=random`
        });
        userNameToBeAdded = '';
        showDropdown = false;
    };

    function removeFriend(friendId: number) {
        friends = friends.filter(friend => friend.id !== friendId);
    };

</script>

<div class="flex flex-col items-center justify-center m-2">
    <div class="text-2xl font-semibold text-gray-900 dark:text-white"> Vertraute </div>
    <div>Füge Menschen hinzu, denen du einen guten Umgang mit deinen Dingen zutraust.</div>
    <div>Du kannst dann bestimmte Dinge nur für  diese Menschen sichtbar machen.</div>
</div>
<div id="searchbar" class="flex items-center justify-center mb-4">
    <div class="relative w-full max-w-md">
        <div class="flex">
            <input
                type="text"
                placeholder="Ich vertraue..."
                class="flex-1 p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                bind:value={userNameToBeAdded}
                oninput={() => showDropdown = true}
            />
        </div>

        {#if showDropdown && filteredUsers.length > 0}
            <div class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {#each filteredUsers as user}
                    <button
                        type="button"
                        class="flex items-center w-full p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-left"
                        onclick={() => addFriend(user.userName)}
                    >
                        <img
                            src={user.profilePic}
                            alt="Profile picture of {user.userName}"
                            class="h-8 w-8 rounded-full object-cover mr-3"
                        />
                        <span class="text-gray-900 dark:text-white">@{user.userName.toLowerCase()}</span>
                    </button>
                {/each}
            </div>
        {/if}
    </div>
</div>

<div class="mx-auto max-w-2xl items-center">
    {#if friends.length === 0}
        <p class="text-center text-gray-500 dark:text-gray-400">Du hast noch keine vertrauten Personen hinzugefügt. Na los ;)</p>
    {/if}
    {#each friends as friend}
        <div class="flex items-center space-x-4 p-4 border-b border-gray-200 dark:border-gray-700">
            <img
                src={friend.profilePic}
                alt="Profile picture of {friend.userName}"
                class="h-12 w-12 rounded-full object-cover"
            />
            <div class="text-left">
                <p class="text-lg font-medium text-gray-900 dark:text-white">@{friend.userName.toLowerCase()}</p>
            </div>
            <Button class="ml-auto cursor-pointer" onclick={() => removeFriend(friend.id)}>X</Button>
        </div>
    {/each}
</div>