<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from 'flowbite-svelte';
	import { UserRemoveOutline } from 'flowbite-svelte-icons';

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
	<div class="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 lg:px-6">
		<div class="mx-auto max-w-screen-sm text-center mb-2 lg:mb-4">
			<h2 class="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
				Vertraute Personen
			</h2>
			<p class="font-light text-gray-500 lg:mb-16 sm:text-xl dark:text-gray-400">
					Füge Menschen hinzu, denen du einen guten Umgang mit deinen Dingen zutraust. Du kannst dann <a href="/profile" class="primary-text hover:underline">deine Dinge</a> nur für diese
		Menschen sichtbar machen.
			</p>
		</div>
	</div>
<!-- SEARCH BAR -->
<div id="searchbar" class="mb-4 flex items-center justify-center">
	<div class="relative w-full max-w-md">
		<div class="flex">
			<input
				type="text"
				placeholder="Ich vertraue..."
				class="flex-1 rounded-l-md border border-primary-300 p-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
				bind:value={usernameToBeAdded}
				onfocus={() => (showDropdown = true)}
				oninput={() => (showDropdown = true)}
				onfocusoutcapture={() => setTimeout(() => (showDropdown = false), 200)}
			/>
		</div>

		{#if showDropdown && filteredUsers.length > 0}
			<div
				class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg dark:border-primary-700 dark:bg-primary-900"
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
							class="flex w-full cursor-pointer items-center p-3 text-left hover:bg-primary-50 dark:hover:bg-primary-900"
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
		<div class="flex items-center space-x-4 border-b border-gray-200 p-4 dark:border-primary-700">
			<img
				src={trustee.profilePic}
				alt="Profile picture of {trustee.username}"
				class="primary-bg h-10 w-10 rounded-full object-cover"
			/>
			<div class="text-left">
				<p class="text-lg font-medium text-gray-900 dark:text-white">@{trustee.username}</p>
			</div>
			<form class="ml-auto" method="POST" action="?/removeTrustee" use:enhance>
				<input type="hidden" name="trusteeId" value={trustee.id}>
				<Button class="min-button ml-auto cursor-pointer bg-secondary-500 hover:bg-secondary-600" type="submit">
					<UserRemoveOutline class="shrink-0 h-5 w-5" />
				</Button>
			</form>
		</div>
	{/each}
</div>
