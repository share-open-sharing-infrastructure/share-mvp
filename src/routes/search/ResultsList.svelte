<script lang="ts">
	import { Gallery } from 'flowbite-svelte';
	import { itemImageUrl } from '$lib/utils/utils';
	import ItemCard from './ItemCard.svelte';
	import type { ItemPublic } from '$lib/types/models';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	let {
		filteredItemList,
		PB_IMG_URL,
		travelTimes = {},
		transportMode = 'bicycle',
	}: {
		filteredItemList: ItemPublic[];
		PB_IMG_URL: string;
		travelTimes: Record<string, number | null>;
		transportMode?: TransportMode;
	} = $props();
</script>

<Gallery class="gap-2 mt-4 grid-cols-1 sm:grid-cols-2">
	{#each filteredItemList as item, i (item.id)}
		<ItemCard
			{item}
			eager={i < 4}
			imgUrl={itemImageUrl(PB_IMG_URL, item, '0x300') ?? ''}
			ownerImgUrl={item.profileImage
				? `${PB_IMG_URL}api/files/users/${item.userId}/${item.profileImage}?thumb=100x100`
				: undefined}
			travelMinutes={travelTimes[item.userId]}
			{transportMode}
		/>
	{/each}
</Gallery>
