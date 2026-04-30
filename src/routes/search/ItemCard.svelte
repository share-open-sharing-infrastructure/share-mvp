<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { Card } from 'flowbite-svelte';
	import { UserCircleOutline, ChevronRightOutline, HeartSolid } from 'flowbite-svelte-icons';
	import { Popover } from 'flowbite-svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import VerifiedIcon from '$lib/components/VerifiedIcon.svelte';
	import TransportModeIcon from '$lib/components/TransportModeIcon.svelte';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	interface Props {
		item: Item;
		imgUrl: string;
		profileView?: boolean;
		/** Travel time in minutes. undefined = not yet fetched, null = owner has no location */
		travelMinutes?: number | null;
		transportMode?: TransportMode;
		currentUserId?: string;
	}
	let {
		item,
		imgUrl,
		profileView = false,
		travelMinutes,
		transportMode = 'bicycle',
		currentUserId,
	}: Props = $props();

	const isTrusted = $derived(
		!!currentUserId && !!item.expand?.owner?.trusts?.includes(currentUserId)
	);
</script>

<Card
	href="/items/{item.id}"
	img={imgUrl}
	class="flex-row relative"
	classes={{ image: 'h-24 w-24 max-h-36 max-w-36 object-cover shrink-0 rounded-s-lg rounded-tr-none rounded-br-none' }}
	horizontal
	size="xl"
>
	{#if !profileView}
		<!-- Owner pill: overlaid on image top-left -->
		<button
			id="owner-{item.id}"
			type="button"
			onclick={(e) => {
				e.preventDefault();
				goto(resolve('/users/[id]', { id: item.expand?.owner?.id ?? '' }));
			}}
			class="absolute top-2 left-3 z-10 rounded-full border hover:cursor-pointer pl-1 pr-2 py-0.5 {isTrusted
				? 'bg-green-50/90 text-green-800 border-green-300 hover:bg-green-100/90'
				: 'bg-white/90 text-tinte-700 border-tinte-300 hover:bg-tinte-50/90'}"
		>
			<UserCircleOutline class="h-6 w-6 inline" />
			<span class="font-medium text-xs">{item.expand?.owner?.username ?? 'Unknown'}</span>
			<div class="absolute top-0 -left-2.5 flex flex-col gap-0.1 items-center">
				{#if item.expand?.owner?.verified}
					<VerifiedIcon class="h-3.5 w-3.5" />
				{/if}
				{#if isTrusted}
					<HeartSolid class="h-3.5 w-3.5 text-green-500 bg-white rounded-full" />
				{/if}
			</div>
		</button>
	{/if}

	<div class="m-6 grow min-w-0">
		

		<h5
			class="mb-2 text-lg md:text-xl font-bold tracking-tight line-clamp-2 text-tinte-900 dark:text-white"
		>
			{item.name}
		</h5>
		{#if !profileView && travelMinutes !== undefined}
			<span
				class="absolute bottom-2 right-2 inline-flex items-center gap-1 text-sm font-medium text-tinte-700 dark:text-tinte-200 bg-primary-100 dark:bg-tinte-700 border border-tinte-200 dark:border-tinte-600 rounded-full px-2.5 py-0.5"
			>
				<TransportModeIcon mode={transportMode} class="h-3.5 w-3.5" />
				{#if travelMinutes === null}
					?
				{:else}
					{texts.pages.search.minutesAway(travelMinutes)}
				{/if}
			</span>
		{/if}
	</div>
</Card>

{#if !profileView && isTrusted}
	<Popover
		triggeredBy="#owner-{item.id}"
		trigger="hover"
		class="w-72 bg-sand text-sm font-light text-tinte-500 dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-400"
		placement="bottom-start"
	>
		<div class="space-y-2 p-3">
			<h3 class="font-semibold text-tinte-900 dark:text-white">
				{texts.ui.trustFunction}
			</h3>
			{texts.ui.trustDescription}
			<a
				href={resolve('/social')}
				class="text-accent hover:underline flex items-center font-medium mt-1"
			>
				{texts.ui.trustFunction}
				<ChevronRightOutline class="text-accent ms-1.5 h-4 w-4" />
			</a>
		</div>
	</Popover>
{/if}
