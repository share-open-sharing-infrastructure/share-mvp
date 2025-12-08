<script lang="ts">
	import type { Item } from "$lib/types/models";
	import { Badge, Img } from "flowbite-svelte";

    export let item: Item;
    export let imgUrl: string;
</script>

<!-- CONTENT -->
<div class="flex p-1 max-h-36">
    <!-- IMAGE -->
    <div class="p-1 flex-shrink-0">
        <div class="h-16 w-16 overflow-hidden rounded-lg bg-gray-100">
            <Img
                src={imgUrl} alt={item.name}
                class="h-full w-full object-cover"
                loading="lazy"
            />
        </div>
    </div>

    <!-- TEXT -->
    <div class="p-1 px-2 border-l mx-2 overflow-hidden">
        <div class="text-lg font-bold p-1">
            {item.name}
        </div>
        <div class="p-1 my-2">
            {item.description}
        </div>
    </div>

</div>

{#if item.trusteesOnly}
    <Badge color="green" class="m-2">Nur an Vertraute</Badge>
{/if}