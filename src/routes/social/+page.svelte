<script lang="ts">
	import { Button } from 'flowbite-svelte';

    const { data } = $props();
    const { users, friends } = data;

    let localUsers = $state([...users]);
    let localFriends = $state([...friends]);

    let usernameToBeAdded: string = $state('');
    let showDropdown: boolean = $state(false);

    localUsers.forEach(user => {
        console.log(user.id + ": " + user.username);
    });

    // Filter users based on input and exclude already added friends
    let filteredUsers = $derived(
        usernameToBeAdded.length > 1 // only start filtering after 2 characters typed
            ? localUsers.filter(user => 
                user.username.toLowerCase().includes(usernameToBeAdded.toLowerCase()) &&
                !localFriends.some(friend => friend.id === user.id)
            )
            : []
    );

    function addFriend(friendName: string) {
        localFriends.push({
            id: localFriends.length + 1,
            username: friendName,
            profilePic: `https://ui-avatars.com/api/?name=${friendName}&background=random`
        });
        usernameToBeAdded = '';
        showDropdown = false;
    };

    function removeFriend(friendId: number) {
        localFriends = localFriends.filter(friend => friend.id !== friendId);
    };

</script>

<!-- HEADER -->
<div class="flex flex-col items-center justify-center m-2">
    <div class="text-2xl font-semibold text-gray-900 dark:text-white"> Vertraute </div>
    <div>Füge Menschen hinzu, denen du einen guten Umgang mit deinen Dingen zutraust.</div>
    <div>Du kannst dann bestimmte Dinge nur für  diese Menschen sichtbar machen.</div>
</div>

<!-- SEARCH BAR -->
<div id="searchbar" class="flex items-center justify-center mb-4">
    <div class="relative w-full max-w-md">
        <div class="flex">
            <input
                type="text"
                placeholder="Ich vertraue..."
                class="flex-1 p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                bind:value={usernameToBeAdded}
                onfocus={() => showDropdown = true}
                oninput={() => showDropdown = true}
                onfocusoutcapture={() => setTimeout(() => showDropdown = false, 200)} 
            />
        </div>

        {#if showDropdown && filteredUsers.length > 0}
            <div class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {#each filteredUsers as user}
                        <button
                            type="button"
                            class="flex items-center w-full p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-left"
                            onclick={() => addFriend(user.username)}
                        >
                            <span class="text-gray-900 dark:text-white">@{user.username}</span>
                        </button>
                    {/each}
            </div>
        {/if}
    </div>
</div>

<!-- FRIEND LIST -->
<div class="mx-auto max-w-2xl items-center">
    {#if localFriends.length === 0}
        <p class="text-center text-gray-500 dark:text-gray-400">Du hast noch keine vertrauten Personen hinzugefügt. Na los ;)</p>
    {/if}
    {#each localFriends as friend}
        <div class="flex items-center space-x-4 p-4 border-b border-gray-200 dark:border-gray-700">
            <img
                src={friend.profilePic}
                alt="Profile picture of {friend.username}"
                class="h-12 w-12 rounded-full object-cover"
            />
            <div class="text-left">
                <p class="text-lg font-medium text-gray-900 dark:text-white">@{friend.username}</p>
            </div>
            <Button class="ml-auto cursor-pointer" onclick={() => removeFriend(friend.id)}>X</Button>
        </div>
    {/each}
</div>