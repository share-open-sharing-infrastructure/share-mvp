<script lang="ts">
	import { Gallery } from 'flowbite-svelte';
	import ItemCard from './ItemCard.svelte';
	import { texts } from '$lib/texts';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	let {
		filteredItemList,
		PB_IMG_URL,
		travelTimes = {},
		transportMode = 'bicycle',
	}: {
		filteredItemList: import('$lib/types/models').Item[];
		PB_IMG_URL: string;
		travelTimes: Record<string, number | null>;
		transportMode: TransportMode;
	} = $props();
</script>

<div class="flex items-center justify-center pt-2">
	<h5>{texts.ui.resultsFound(filteredItemList.length)}</h5>
</div>

<Gallery class="grid-cols-1 gap-4 pt-2 max-md:grid-cols-2 max-sm:grid-cols-1">
	{#each filteredItemList as item (item.id)}
		<ItemCard
			{item}
			imgUrl={`${PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}`}
			travelMinutes={travelTimes[item.expand?.owner?.id]}
			{transportMode}
		/>
	{/each}
</Gallery>
