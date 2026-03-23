<script lang="ts">
	import { enhance } from '$app/forms';
	import { Toggle } from 'flowbite-svelte';
	import { AccordionItem, Accordion } from 'flowbite-svelte';
	import { UserCircleOutline, MapPinOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import ItemCard from '../../search/ItemCard.svelte';

	const { data } = $props();
	const profileUser = $derived(data.profileUser);
	const publicItems = $derived(data.publicItems);
	const trustedItems = $derived(data.trustedItems);
	const isOwnProfile = $derived(data.isOwnProfile);
	const viewerTrustsProfile = $derived(data.viewerTrustsProfile);
	const profileTrustsViewer = $derived(data.profileTrustsViewer);

	// svelte-ignore state_referenced_locally
	const activeSinceDate = new Intl.DateTimeFormat('de-DE', {
		month: 'long',
		year: 'numeric',
	}).format(new Date(profileUser.created));

	let trustForm: HTMLFormElement = $state()!;
</script>

<div class="mx-auto max-w-3xl px-4 py-6 space-y-8">
	<!-- Profile Header -->
	<div class="flex items-center gap-6">
		<!-- TODO: replace with actual profile image once implemented -->
		<div
			class="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
		>
			<UserCircleOutline class="h-14 w-14 text-gray-400" />
		</div>
		<div class="space-y-1">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
				@{profileUser.username}
			</h1>
			{#if profileUser.city}
				<p class="flex items-center gap-1 text-accent font-medium">
					<MapPinOutline class="h-4 w-4" />
					{profileUser.city}
				</p>
			{/if}
			<p class="text-sm text-gray-500 dark:text-gray-400">
				{texts.pages.userProfile.activeSince(activeSinceDate)}
			</p>
		</div>
	</div>

	<!-- Trust Section (hidden on own profile) -->
	{#if !isOwnProfile}
		<div
			class="rounded-lg border border-gray-200 dark:border-primary-700 p-4 space-y-3"
		>
			<!-- Does the profile owner trust the viewer? -->
			<p class="text-sm text-gray-600 dark:text-gray-400">
				{#if profileTrustsViewer}
					✓ {texts.pages.userProfile.trustsYou}
				{:else}
					{texts.pages.userProfile.doesNotTrustYou}
				{/if}
			</p>

			<!-- Does the viewer trust the profile owner? -->
			<form
				method="POST"
				action={viewerTrustsProfile ? '?/removeTrust' : '?/addTrust'}
				use:enhance
				bind:this={trustForm}
			>
				<Toggle
					checked={viewerTrustsProfile}
					onchange={() => trustForm?.requestSubmit()}
				>
					{viewerTrustsProfile
						? texts.pages.userProfile.trustsThisUser
						: texts.pages.userProfile.doesNotTrustThisUser}
				</Toggle>
			</form>
		</div>
	{/if}

	<Accordion multiple>
		<AccordionItem open>
			{#snippet header()}{texts.pages.userProfile.publicItems}{/snippet}
			<!-- Public Items Section -->
			<section>
				{#if publicItems.length === 0}
					<p class="text-gray-500 dark:text-gray-400">
						{texts.pages.userProfile.noPublicItems}
					</p>
				{:else}
					<div class="space-y-2">
						{#each publicItems as item (item.id)}
							<ItemCard
								{item}
								imgUrl={`${data.PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}`}
								profileView={true}
							/>
						{/each}
					</div>
				{/if}
			</section>
		</AccordionItem>
		<AccordionItem>
			{#snippet header()}
						{texts.pages.userProfile.trustedItems}{/snippet}
			<!-- Trusted-Only Items Section -->
			{#if trustedItems !== null && trustedItems.length > 0}
					<div class="space-y-3">
						{#each trustedItems as item (item.id)}
							<ItemCard
								{item}
								imgUrl={`${data.PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}`}
								profileView={true}
							/>
						{/each}
					</div>
			{:else if trustedItems === null}
				<section class="space-y-2">
					<p class="text-gray-500 dark:text-gray-400">
						{texts.pages.userProfile.notTrustedNote}
					</p>
				</section>
			{/if}
		</AccordionItem>
	</Accordion>
</div>
