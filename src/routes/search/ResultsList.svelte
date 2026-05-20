<script lang="ts">
	import { Gallery } from 'flowbite-svelte';
	import ItemCard from './ItemCard.svelte';
	import type { ItemPublic } from '$lib/types/models';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	let {
		filteredItemList,
		PB_IMG_URL,
		travelTimes = {},
		transportMode = 'bicycle',
		currentUserId,
	}: {
		filteredItemList: ItemPublic[];
		PB_IMG_URL: string;
		travelTimes: Record<string, number | null>;
		transportMode?: TransportMode;
		currentUserId?: string;
	} = $props();
</script>

<Gallery class="gap-2 mt-4 grid-cols-1 sm:grid-cols-2">
	{#each filteredItemList as item (item.id)}
		<ItemCard
			{item}
			imgUrl={item.image ? `${PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}` : (item.externalImgUrl ?? '')}
			ownerImgUrl={item.profileImage
				? `${PB_IMG_URL}api/files/users/${item.userId}/${item.profileImage}`
				: undefined}
			travelMinutes={travelTimes[item.userId]}
			{transportMode}
			{currentUserId}
		/>
	{/each}
</Gallery>
