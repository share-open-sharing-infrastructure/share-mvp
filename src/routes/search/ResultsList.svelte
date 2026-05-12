<script lang="ts">
	import { Gallery } from 'flowbite-svelte';
	import ItemCard from './ItemCard.svelte';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	let {
		filteredItemList,
		PB_IMG_URL,
		travelTimes = {},
		transportMode = 'bicycle',
		currentUserId,
	}: {
		filteredItemList: import('$lib/types/models').Item[];
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
			ownerImgUrl={item.expand?.owner?.profileImage
				? `${PB_IMG_URL}api/files/users/${item.expand.owner.id}/${item.expand.owner.profileImage}`
				: undefined}
			travelMinutes={travelTimes[item.expand?.owner?.id]}
			{transportMode}
			{currentUserId}
		/>
	{/each}
</Gallery>
