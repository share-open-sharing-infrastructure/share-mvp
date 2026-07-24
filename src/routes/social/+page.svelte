<script lang="ts">
	import { enhance } from '$app/forms';
	import { Tooltip } from 'flowbite-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { UserAddOutline, SearchOutline } from 'flowbite-svelte-icons';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts.js';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import TrustNetworkTable from './TrustNetworkTable.svelte';

	const { data } = $props();

	// ── Unified search (shared with the table via its `search` prop) ─────────────
	let search = $state('');
	let showAddDropdown = $state(false);
	let addFeedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	let filteredUsers = $derived(
		search.length > 1
			? data.users.filter(
					(user) =>
						user.username.toLowerCase().includes(search.toLowerCase()) &&
						!data.trustNetwork.some((n: { id: string }) => n.id === user.id) &&
						user.id !== data.currentUser.id
				)
			: []
	);
</script>

<SeoHead title={texts.seo.social.title} robots="noindex, nofollow" />


<!-- HEADER -->
<div class="px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center">
		<h2 class="mb-4 text-2xl tracking-tight font-extrabold text-tinte-900 dark:text-white">
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

<!-- INVITE SECTION -->
<div class="max-w-2xl mx-auto px-4 py-6">
	<div class="bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-6 sm:p-8">
		<h2 class="text-lg font-semibold text-tinte-900 dark:text-white mb-2">
			{texts.pages.invite.sectionTitle}
		</h2>
		<p class="text-sm text-tinte-600 dark:text-tinte-400 mb-4">
			{texts.pages.invite.description}
		</p>
		<div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
			<input
				type="text"
				readonly
				value={data.inviteUrl}
				class="flex-1 px-3 py-2 bg-tinte-100 border border-tinte-200 rounded-lg text-sm text-tinte-600 cursor-default dark:bg-tinte-700 dark:border-tinte-600 dark:text-tinte-400 truncate"
			/>
			<ShareButton
				url={data.inviteUrl}
				shareText={texts.pages.invite.shareText(data.username)}
				label={texts.pages.invite.shareButton}
				copiedLabel={texts.pages.invite.linkCopied}
				icon={UserAddOutline}
				class="w-full whitespace-nowrap"
			/>
		</div>
	</div>
</div>

<!-- UNIFIED SEARCH BAR -->
<div class="mb-6 px-2 flex items-center justify-center">
	<div class="relative w-full max-w-md">
		<div class="relative flex items-center">
			<input
				type="text"
				placeholder={texts.pages.social.searchPlaceholder}
				class="search-bar w-full pr-10"
				bind:value={search}
				oninput={() => (showAddDropdown = false)}
			/>
			{#if search.length > 1}
				<button
					type="button"
					onclick={() => (showAddDropdown = !showAddDropdown)}
					class="flex absolute right-2 text-tinte-400 hover:text-primary transition-colors cursor-pointer"
					title="Nutzer:in hinzufügen"
				>
					<span class="text-md text-tinte-400 mr-2">{texts.pages.social.searchNewUser}</span>
					<SearchOutline class="h-5 w-5" />
				</button>
			{/if}
		</div>

		{#if showAddDropdown}
			<div class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-tinte-300 bg-sand shadow-lg dark:border-primary-700 dark:bg-primary-900">
				{#if filteredUsers.length === 0}
					<p class="p-3 text-sm text-tinte-400">{texts.pages.social.noNewUsersFound}</p>
				{:else}
					{#each filteredUsers as potentialFriend (potentialFriend.id)}
						<div class="flex items-center hover:bg-primary-50 dark:hover:bg-primary-900">
							<a
								href={resolve('/users/[id]', { id: potentialFriend.id })}
								class="flex-1 p-3 text-tinte-900 dark:text-white"
							>
								@{potentialFriend.username}
							</a>
							<form
								method="POST"
								action="?/addTrustee"
								use:enhance={() => async ({ result, update }) => {
									await update();
									search = '';
									showAddDropdown = false;
									if (result.type === 'success' && result.data) {
										addFeedback = { type: 'success', message: result.data.message as string };
									} else if (result.type === 'failure') {
										addFeedback = { type: 'error', message: (result.data?.message as string) ?? texts.errors.somethingWentWrong };
									}
								}}
							>
								<input type="hidden" name="trusteeId" value={potentialFriend.id} />
								<input type="hidden" name="trusteeUsername" value={potentialFriend.username} />
								<Button
									type="submit"
									size="icon"
									id="add-btn-{potentialFriend.id}"
									aria-label={texts.pages.social.addTrustee}
									class="mx-2"
								>
									<UserAddOutline class="h-6 w-6" />
								</Button>
								<Tooltip triggeredBy="#add-btn-{potentialFriend.id}" type="light" placement="left" trigger="click">
									{texts.pages.social.addTrustee}
								</Tooltip>
							</form>
						</div>
					{/each}
				{/if}
			</div>
		{/if}

		{#if addFeedback}
			<div class="mt-3">
				<CustomAlert type={addFeedback.type} message={addFeedback.message} />
			</div>
		{/if}
	</div>
</div>



<!-- TRUST NETWORK TABLE -->
<TrustNetworkTable trustNetwork={data.trustNetwork} {search} />
