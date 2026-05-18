<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { Card } from 'flowbite-svelte';
	import { UserCircleOutline, HeartSolid } from 'flowbite-svelte-icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import VerifiedIcon from '$lib/components/VerifiedIcon.svelte';
	import TransportModeIcon from '$lib/components/TransportModeIcon.svelte';
	import { getCategoryPlaceholder } from '$lib/utils/categoryPlaceholder';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	interface Props {
		item: Item;
		imgUrl: string;
		/** Owner profile image URL — used as a low-opacity placeholder when the item has no image */
		ownerImgUrl?: string;
		profileView?: boolean;
		/** Travel time in minutes. undefined = not yet fetched, null = owner has no location */
		travelMinutes?: number | null;
		transportMode?: TransportMode;
		currentUserId?: string;
	}
	let {
		item,
		imgUrl,
		ownerImgUrl,
		profileView = false,
		travelMinutes,
		transportMode = 'bicycle',
		currentUserId,
	}: Props = $props();

	const isTrusted = $derived(
		!!currentUserId && !!item.expand?.owner?.trusts?.includes(currentUserId)
	);
	const isInstitution = $derived(!!item.expand?.owner?.isInstitution);
	const hasRealImage = $derived(!!imgUrl);
	const categoryPlaceholder = $derived(getCategoryPlaceholder(item.categories));
</script>

<Card
	href="/items/{item.id}"
	img={hasRealImage ? imgUrl : undefined}
	class="flex-row relative"
	classes={{ image: 'w-24 max-h-36 max-w-36 object-cover shrink-0 rounded-s-lg rounded-tr-none rounded-br-none' }}
	horizontal
	size="xl"
>
	{#if !hasRealImage}
		<!-- Placeholder sits in the same flex position as <img> would — no img prop means no Card img element.
		     w-24 md:w-48 max-w-36 mirrors the theme's md:w-48 + our max-w-36 on the real <img>. -->
		<div class="w-24 md:w-48 max-w-36 shrink-0 self-stretch rounded-s-lg rounded-tr-none rounded-br-none bg-gray-100 flex items-center justify-center overflow-hidden">
			{#if categoryPlaceholder}
				<img src={categoryPlaceholder} alt="" class="w-full h-full object-contain p-3 opacity-30" />
			{:else}
				<span class="text-[10px] text-gray-400 text-center px-1 leading-tight">{texts.institutional.imagePlaceholder}</span>
			{/if}
		</div>
	{/if}

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
			{#if isInstitution}
				<HomeOutline class="h-6 w-6 inline" />
			{:else}
				<UserCircleOutline class="h-6 w-6 inline" />
			{/if}
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
			class="mb-2 text-lg font-bold tracking-tight line-clamp-1 text-tinte-900 dark:text-white"
		>
			{item.name}
		</h5>
		<div class="text-sm line-clamp-2 text-tinte-500 dark:text-tinte-400 mt-2">
			{item.description}
		</div>
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
