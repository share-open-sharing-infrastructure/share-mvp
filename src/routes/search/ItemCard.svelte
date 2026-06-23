<script lang="ts">
	import type { ItemPublic } from '$lib/types/models';
	import { Card } from 'flowbite-svelte';
	import { UserCircleOutline, HomeOutline } from 'flowbite-svelte-icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import VerifiedIcon from '$lib/components/VerifiedIcon.svelte';
	import TransportModeIcon from '$lib/components/TransportModeIcon.svelte';
	import { getCategoryPlaceholder } from '$lib/utils/categoryPlaceholder';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	interface Props {
		item: ItemPublic;
		imgUrl: string;
		ownerImgUrl?: string;
		profileView?: boolean;
		/** Travel time in minutes. undefined = not yet fetched, null = owner has no location */
		travelMinutes?: number | null;
		transportMode?: TransportMode;
	}
	let {
		item,
		imgUrl,
		ownerImgUrl,
		profileView = false,
		travelMinutes,
		transportMode = 'bicycle',
	}: Props = $props();

	const isInstitution = $derived(!!item.isInstitution);
	const hasRealImage = $derived(!!imgUrl);
	const categoryPlaceholder = $derived(getCategoryPlaceholder(item.categories));
</script>

<Card
	href="/items/{item.id}"
	class="flex-row relative"
	horizontal
	size="xl"
>
	<!-- Image area always in slot so we can overlay the availability badge -->
	<div class="relative w-24 max-w-36 shrink-0 self-stretch rounded-s-lg overflow-hidden">
		{#if hasRealImage}
			<img src={imgUrl} alt={item.name} class="w-full h-full max-h-36 object-cover" />
		{:else}
			<div class="w-full h-full bg-gray-100 flex items-center justify-center">
				{#if categoryPlaceholder}
					<img src={categoryPlaceholder} alt="" class="w-full h-full object-contain p-3 opacity-30" />
				{:else}
					<span class="text-[10px] text-gray-400 text-center px-1 leading-tight">{texts.institutional.imagePlaceholder}</span>
				{/if}
			</div>
		{/if}
		{#if item.status === 'unavailable'}
			<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
				<span class="text-xs font-semibold rounded-full px-2.5 py-1 border bg-red-50/90 text-red-600 border-red-300">
					{texts.itemStatus.unavailable}
				</span>
			</div>
		{/if}
	</div>

	<div class="m-3 grow min-w-0 flex flex-col">
		<h5
			class="text-lg font-bold tracking-tight line-clamp-1 text-tinte-900 dark:text-white"
		>
			{item.name}
		</h5>
		<div class="text-sm line-clamp-2 text-tinte-500 dark:text-tinte-400 mt-2">
			{item.description}
		</div>
		{#if !profileView}
			<div class="mt-auto pt-3 flex items-center justify-end gap-1.5">
				{#if travelMinutes !== undefined}
					<span
						class="inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap text-tinte-700 dark:text-tinte-200 bg-primary-100 dark:bg-tinte-700 border border-tinte-200 dark:border-tinte-600 rounded-full px-2.5 py-0.5"
					>
						<TransportModeIcon mode={transportMode} class="h-3.5 w-3.5" />
						{#if travelMinutes === null}
							?
						{:else}
							{texts.pages.search.minutesAway(travelMinutes)}
						{/if}
					</span>
				{/if}
				<button
					id="owner-{item.id}"
					type="button"
					onclick={(e) => {
						e.preventDefault();
						goto(resolve('/users/[id]', { id: item.userId ?? '' }));
					}}
					class="relative inline-flex items-center rounded-full border hover:cursor-pointer pl-1 pr-2 py-0.5 bg-white/90 text-tinte-700 border-tinte-300 hover:bg-tinte-50/90"
				>
					{#if ownerImgUrl}
						<img src={ownerImgUrl} alt="" class="h-6 w-6 rounded-full object-cover" />
					{:else if isInstitution}
						<HomeOutline class="h-6 w-6 inline" />
					{:else}
						<UserCircleOutline class="h-6 w-6 inline" />
					{/if}
					<span class="font-medium text-xs max-w-20 truncate ml-1">{item.username ?? 'Unknown'}</span>
					<div class="absolute top-0 -right-1.5 flex flex-col gap-0.1 items-center">
						{#if item.verified}
							<VerifiedIcon class="h-3.5 w-3.5" />
						{/if}
					</div>
				</button>
			</div>
		{/if}
	</div>
</Card>
