<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { Badge, Img } from 'flowbite-svelte';

	interface Props {
		item: Item;
		imgUrl: string;
	}

	let { item, imgUrl }: Props = $props();
</script>

<!-- CONTENT -->
<div class="flex max-h-36 p-1">
	<!-- IMAGE -->
	<div class="shrink-0 p-1">
		<div class="h-16 w-16 overflow-hidden rounded-lg bg-primary-100">
			<Img src={imgUrl} alt={item.name} class="h-full w-full object-cover item-image" loading="lazy" />
		</div>
	</div>

	<!-- TEXT -->
	<div class="mx-2 overflow-hidden border-l p-1 px-2">
		<div class="p-1 text-lg font-bold">
			{item.name}
		</div>
		<div class="my-2 p-1">
			{item.description}
		</div>
		<div class="my-2 p-1">
			{item.place}
		</div>
	</div>
</div>

{#if item.trusteesOnly}
	<Badge color="green" class="m-2">Nur an Vertraute</Badge>
{/if}
