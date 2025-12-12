<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from 'flowbite-svelte';

	const { data } = $props();

	let usernameToBeAdded: string = $state('');
	let showDropdown: boolean = $state(false);

	// Filter users based on input and exclude already added trustees
	let filteredUsers = $derived(
		usernameToBeAdded.length > 1 // only start filtering after 2 characters typed
			? data.users.filter(
					(user) =>
						user.username.toLowerCase().includes(usernameToBeAdded.toLowerCase()) && // Match names
						!data.trustees.some((trustee) => trustee.id === user.id) && // Filter out existing trustees
						user.id !== data.currentUser.id // Exclude self
				)
			: []
	);
</script>

<!-- HEADER -->
<div class="m-2 mb-6 flex flex-col items-center justify-center">
	<div class="text-2xl font-semibold text-gray-900 dark:text-white">Vertraute</div>
	<div>Füge Menschen hinzu, denen du einen guten Umgang mit deinen Dingen zutraust.</div>
	<div>
		Du kannst dann <a href="/profile" class="text-blue-600 hover:underline">deine Dinge</a> nur für diese
		Menschen sichtbar machen.
	</div>
</div>

<!-- SEARCH BAR -->
<div id="searchbar" class="mb-4 flex items-center justify-center">
	<div class="relative w-full max-w-md">
		<div class="flex">
			<input
				type="text"
				placeholder="Ich vertraue..."
				class="flex-1 rounded-l-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				bind:value={usernameToBeAdded}
				onfocus={() => (showDropdown = true)}
				oninput={() => (showDropdown = true)}
				onfocusoutcapture={() => setTimeout(() => (showDropdown = false), 200)}
			/>
		</div>

		{#if showDropdown && filteredUsers.length > 0}
			<div
				class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800"
			>
				{#each filteredUsers as potentialFriend}
					<form
						method="POST"
						action="?/addTrustee"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								usernameToBeAdded = '';
								showDropdown = false;
							};
						}}
					>
						<input type="hidden" name="trusteeId" value={potentialFriend.id} />
						<button
							class="flex w-full cursor-pointer items-center p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
							type="submit"
						>
							<span class="text-gray-900 dark:text-white">@{potentialFriend.username}</span>
						</button>
					</form>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- FRIEND LIST -->
<div class="mx-auto max-w-2xl items-center">
	{#if data.trustees.length === 0}
		<p class="text-center text-gray-500 dark:text-gray-400">
			Du hast noch keine vertrauten Personen hinzugefügt. Na los ;)
		</p>
	{/if}
	{#each data.trustees as trustee}
		<div class="flex items-center space-x-4 border-b border-gray-200 p-4 dark:border-gray-700">
			<img
				src={trustee.profilePic}
				alt="Profile picture of {trustee.username}"
				class="h-12 w-12 rounded-full object-cover"
			/>
			<div class="text-left">
				<p class="text-lg font-medium text-gray-900 dark:text-white">@{trustee.username}</p>
			</div>
			<form class="ml-auto" method="POST" action="?/removeTrustee" use:enhance>
				<input type="hidden" name="trusteeId" value={trustee.id} />
				<Button class="ml-auto cursor-pointer" type="submit">X</Button>
			</form>
		</div>
	{/each}
</div>
