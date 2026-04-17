<script lang="ts">
	import { Button, Tooltip, Input, Badge } from 'flowbite-svelte';
	import { MapPinOutline, UserCircleOutline, ImageOutline, MessagesOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	const { data } = $props();
	// svelte-ignore state_referenced_locally
	const { item, PB_IMG_URL } = data;
	const isTrustRestricted = $derived(data.isTrustRestricted);
	const isOwnItem = $derived(data.isOwnItem);

	const imageUrl =
		item.image
			? `${PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}`
			: null;
</script>

<div class="mx-auto max-w-3xl px-4 py-6 space-y-6">
	<!-- <a
		class="text-lg text-primary hover:underline cursor-pointer mb-2 inline-block"
		href={resolve('/search')}
	>
		{texts.pages.itemDetail.backToSearch}
	</a> -->

	<!-- Image -->
	{#if imageUrl}
		<img
			src={imageUrl}
			alt={item.name}
			class="w-full max-h-96 object-contain rounded-lg bg-papier"
		/>
	{:else}
		<div class="w-full h-64 flex flex-col items-center justify-center rounded-lg bg-tinte-100 text-tinte-400 gap-2">
			<ImageOutline class="h-16 w-16" />
			<span class="text-sm">{texts.pages.itemDetail.noImage}</span>
		</div>
	{/if}

	<!-- Owner + Location (directly below image) -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<a href={resolve('/users/[id]', { id: item.expand?.owner?.id ?? '' })} class="flex items-center gap-2 text-primary-200 border border-primary-200 rounded-full px-3 py-1 hover:bg-primary-50">
				<UserCircleOutline class="h-5 w-5 shrink-0" />
				<span class="font-medium">{item.expand?.owner?.username ?? 'Unknown'}</span>
			</a>
		</div>
		{#if item.expand?.owner?.city}
			<span class="flex items-center gap-1 text-accent font-medium">
				<MapPinOutline class="h-4 w-4" />
				{item.expand.owner.city}
			</span>
		{/if}
	</div>

	<!-- Item name -->
	<h1 class="text-3xl font-bold tracking-tight text-tinte-900 dark:text-white">
		{item.name}
	</h1>

	<!-- Categories -->
	{#if item.categories && item.categories.length > 0}
		<div class="flex flex-wrap gap-2">
			{#each item.categories as cat(cat)}
				<Badge color="indigo">{cat}</Badge>
			{/each}
		</div>
	{/if}

	<!-- Description -->
	{#if item.description}
		<p class="leading-relaxed text-tinte-700 dark:text-tinte-300">
			{item.description}
		</p>
	{/if}

	<!-- Anfragen CTA / Status Toggle -->
	<div class="flex justify-end">
		{#if isOwnItem}
			<form method="POST" action="?/toggleStatus" use:enhance>
				<button
					type="submit"
					class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold border transition-colors cursor-pointer
						{data.item.status === 'available'
							? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
							: 'bg-accent-100 text-accent-800 border-accent-300 hover:bg-accent-200'}"
				>
					{data.item.status === 'available' ? texts.itemStatus.available : texts.itemStatus.unavailable}
					<span class="ml-2 text-xs opacity-60">
						{'→ ' + (data.item.status === 'available' ? texts.itemStatus.markUnavailable : texts.itemStatus.markAvailable)}
					</span>
				</button>
			</form>
		{:else if isTrustRestricted}
			<Button pill disabled class="min-button bg-primary opacity-50 cursor-not-allowed">
				<MessagesOutline class="h-4 w-4 mr-2" />
				{texts.pages.itemDetail.requestButton}
			</Button>
			<Tooltip type="light" placement="top">
				{texts.pages.itemDetail.trustRestrictedTooltip}
			</Tooltip>
		{:else}
			<form method="POST" action="?/startConversation">
				<Input name="itemId" value={item.id} hidden />
				<Input name="ownerId" value={item.expand?.owner?.id} hidden />
				<Button pill type="submit" class="cursor-pointer min-button bg-primary">
					<MessagesOutline class="h-4 w-4 mr-2" />
					{texts.pages.itemDetail.requestButton}
				</Button>
			</form>
		{/if}
	</div>
</div>
