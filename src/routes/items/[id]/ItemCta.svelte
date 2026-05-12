<script lang="ts">
	import { Button, Tooltip, Input } from 'flowbite-svelte';
	import { MessagesOutline } from 'flowbite-svelte-icons';
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import type { Item } from '$lib/types/models';

	interface Props {
		item: Item;
		isExternal: boolean;
		isOwnItem: boolean;
		isTrustRestricted: boolean;
		isArchived: boolean;
	}

	const { item, isExternal, isOwnItem, isTrustRestricted, isArchived }: Props = $props();
</script>

<div class="flex items-center gap-3">
	{#if isExternal}
		<!-- External item: deep-link CTA -->
		<!-- Status badge lives near the page title; only the hint for unknown status is shown here -->
		{#if item.status === 'unknown'}
			<span class="text-sm text-tinte-500 dark:text-tinte-400">
				{texts.institutional.availabilityHintExternal}
			</span>
		{/if}
		{#if !isArchived && item.externalUrl}
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={`/api/redirect?to=${encodeURIComponent(item.externalUrl)}&source=item-detail&item=${item.id}`}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold bg-primary-200 hover:bg-primary text-tinte-900 transition-colors"
			>
				{texts.institutional.externalLendCta(item.expand?.owner?.username ?? '')}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
	{:else if isOwnItem}
		<!-- Own item: status toggle -->
		<form method="POST" action="?/toggleStatus" use:enhance>
			<button
				type="submit"
				class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold border transition-colors cursor-pointer
					{item.status === 'available'
						? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
						: item.status === 'unavailable'
						? 'bg-accent-100 text-accent-800 border-accent-300 hover:bg-accent-200'
						: 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'}"
			>
				{item.status === 'available'
					? texts.itemStatus.available
					: item.status === 'unavailable'
					? texts.itemStatus.unavailable
					: texts.itemStatus.unknown}
				{#if item.status !== 'unknown'}
					<span class="ml-2 text-xs opacity-60">
						{'→ ' + (item.status === 'available' ? texts.itemStatus.markUnavailable : texts.itemStatus.markAvailable)}
					</span>
				{/if}
			</button>
		</form>
	{:else if item.status === 'unknown'}
		<!-- Status is shown near the title; nothing actionable to display here -->
	{:else if isTrustRestricted}
		<Button pill disabled class="min-button bg-primary-200 hover:bg-primary opacity-50 cursor-not-allowed">
			<MessagesOutline class="h-4 w-4 mr-2" />
			{texts.pages.itemDetail.requestButton}
		</Button>
		<Tooltip type="light" placement="top">
			{texts.pages.itemDetail.trustRestrictedTooltip}
		</Tooltip>
	{:else}
		<form method="POST" action="?/startConversation">
			<Input name="itemId" value={item.id} hidden />
			<Button pill type="submit" class="cursor-pointer min-button bg-primary-200 hover:bg-primary">
				<MessagesOutline class="h-4 w-4 mr-2" />
				{texts.pages.itemDetail.requestButton}
			</Button>
		</form>
	{/if}
</div>
