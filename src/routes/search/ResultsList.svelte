<script lang="ts">
	import { Gallery } from "flowbite-svelte";
	import ItemCard from "./ItemCard.svelte";

    let { filteredItemList, PB_IMG_URL, requesterId } = $props();

</script>

<div class="flex items-center justify-center pt-2">
    <h5>{filteredItemList.length} Dinge gefunden</h5>
</div>

<Gallery
    class="mx-auto max-w-5xl grid-cols-1 gap-4 pt-2 max-md:grid-cols-2 max-sm:grid-cols-3 md:grid-cols-1"
>
    {#each filteredItemList as item}
        <ItemCard
            {item}
            imgUrl={`${PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}`}
            {requesterId}
        />
    {/each}
</Gallery>