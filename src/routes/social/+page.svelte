<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Tooltip } from 'flowbite-svelte';
	import { UserRemoveOutline } from 'flowbite-svelte-icons';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts.js';

	const { data } = $props();

	let usernameToBeAdded: string = $state('');
	let showDropdown: boolean = $state(false);

	// Filter users based on input and exclude already added trustees
	let filteredUsers = $derived(
		usernameToBeAdded.length > 1 // only start filtering after 2 characters typed
			? data?.users?.filter(
					(user) =>
						user.username
							.toLowerCase()
							.includes(usernameToBeAdded.toLowerCase()) && // Match names
						!data.trustees.some((trustee) => trustee.id === user.id) && // Filter out existing trustees
						user.id !== data.currentUser.id // Exclude self
				)
			: []
	);
</script>

<!-- HEADER -->
<div class="pb-4 px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center mb-2 lg:mb-4">
		<h2
			class="mb-4 text-2xl tracking-tight font-extrabold text-tinte-900 dark:text-white"
		>
			{texts.ui.trustedPeople}
		</h2>
		<p class="font-light text-tinte-500 dark:text-tinte-400">
			{texts.ui.trustDescriptionSocial}
			zutraust. Du kannst dann
			<a href={resolve('/user/items')} class="text-primary hover:underline"
				>{texts.pages.social.yourItems}</a
			>
			nur für diese Menschen sichtbar machen.
		</p>
	</div>
</div>
<!-- SEARCH BAR -->
<div id="searchbar" class="mb-4 p-2 flex items-center justify-center">
	<div class="relative w-full max-w-md">
		<div class="flex">
			<input
				type="text"
				placeholder="Ich vertraue..."
				class="search-bar flex-1"
				bind:value={usernameToBeAdded}
				onfocus={() => (showDropdown = true)}
				oninput={() => (showDropdown = true)}
				onfocusoutcapture={() => setTimeout(() => (showDropdown = false), 200)}
			/>
		</div>

		{#if showDropdown && filteredUsers && filteredUsers.length > 0}
			<div
				class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-tinte-300 bg-sand shadow-lg dark:border-primary-700 dark:bg-primary-900"
			>
				{#each filteredUsers as potentialFriend (potentialFriend.id)}
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
							<span class="text-tinte-900 dark:text-white"
								>@{potentialFriend.username}</span
							>
						</button>
					</form>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- FRIEND LIST -->
<div class="mx-auto max-w-sm items-center">
	{#if data.trustees.length === 0}
		<p class="text-center text-tinte-500 dark:text-tinte-400">
			Du hast noch keine vertrauten Personen hinzugefügt. Na los ;)
		</p>
	{/if}
	{#each data.trustees as trustee (trustee.id)}
		<div
			class="flex items-center space-x-4 border-b border-tinte-200 p-4 dark:border-primary-700 hover:bg-primary-50 rounded-lg"
		>
			<a href={resolve(`/users/[id]`, { id: trustee.id })}
			class="flex items-center gap-4 text-tinte-900 dark:text-white w-full ">
				<img
				src={trustee.profilePic}
				alt="Profile picture of {trustee.username}"
				class="primary-bg h-10 w-10 rounded-full object-cover"
				/>
				<div class="text-left">
					<span class="text-lg font-medium text-tinte-900 dark:text-white">
						@{trustee.username}
					</span>
				</div>
			</a>
			<form class="ml-auto" method="POST" action="?/removeTrustee" use:enhance>
				<input type="hidden" name="trusteeId" value={trustee.id} />
				<Button
					class="min-button ml-auto cursor-pointer bg-primary"
					type="submit"
				>
					<UserRemoveOutline class="shrink-0 h-5 w-5" />
				</Button>
				<Tooltip type="light" placement="top"
					>{trustee.username} {texts.ui.revokeTrust}</Tooltip
				>
			</form>
		</div>
	{/each}
</div>

<!-- TRUSTED BY LIST -->
<div class="mx-auto max-w-sm items-center mt-10">
	<h3 class="mb-4 text-xl font-bold text-center text-tinte-900 dark:text-white">
		{texts.ui.trustedByPeople}
	</h3>
	{#if data.trustedBy.length === 0}
		<p class="text-center text-tinte-500 dark:text-tinte-400">{texts.ui.noOneTrustsYet}</p>
	{/if}
	{#each data.trustedBy as user (user.id)}
		<a
			href={resolve(`/users/[id]`, { id: user.id })}
			class="flex items-center gap-4 border-b border-tinte-200 p-4 dark:border-primary-700 hover:bg-primary-50 rounded-lg text-tinte-900 dark:text-white"
		>
			<img
				src={user.profilePic}
				alt="Profile picture of {user.username}"
				class="primary-bg h-10 w-10 rounded-full object-cover"
			/>
			<span class="text-lg font-medium">@{user.username}</span>
		</a>
	{/each}
</div>
