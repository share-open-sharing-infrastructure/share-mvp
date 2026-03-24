<script lang="ts">
	import { Gallery } from 'flowbite-svelte';
	import ItemCard from './ItemCard.svelte';
	import { texts } from '$lib/texts';

	let { filteredItemList, PB_IMG_URL } = $props();
</script>

<div class="flex items-center justify-center pt-2">
	<h5>{texts.ui.resultsFound(filteredItemList.length)}</h5>
</div>

<Gallery class="gap-2 mt-4 grid-cols-1 md:grid-cols-2">
	{#each filteredItemList as item (item.id)}
		<ItemCard
			{item}
			imgUrl={`${PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}`}
		/>
	{/each}
</Gallery>
