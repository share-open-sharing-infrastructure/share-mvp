<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { Badge } from 'flowbite-svelte';
	import { MapPinOutline } from 'flowbite-svelte-icons';
	import EditButton from './EditButton.svelte';
	import ItemModal from './ItemModal.svelte';

	interface Props {
		item: Item;
		imgUrl: string;
		data: any;
	}
	let { item, imgUrl, data }: Props = $props();
	let showEditModal = $state(false);
	let editingItemId = $state('');
	let editingItem = $derived(
		data?.user?.expand?.items_via_owner
			? data.user.expand.items_via_owner.find((item: Item) => item.id === editingItemId)
			: null
	);
	function getItemImageUrl(item: Item, baseUrl: string): string {
		return `${baseUrl}api/files/${item?.collectionId}/${item?.id}/${item?.image}`;
	}
</script>

<div class="items-center border border-gray-200 rounded-lg shadow sm:flex">
	<img class="m-5 w-40 h-40 rounded-lg" src={imgUrl} alt={item.name} />

	<div class="p-2">
		<h3 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
			{item.name}
		</h3>
		<span class="flex items-center text-sm">
			<MapPinOutline class="h-4 w-4" />
			{item.place}
		</span>
		<p class="my-2 font-light text-gray-500 dark:text-gray-400">
			{item.description}
		</p>
		{#if item.trusteesOnly}
			<div>
				<Badge rounded border color="green" class="my-2">
					<span class="text-green-900 bg-green-100">Nur an Vertraute</span>
				</Badge>
			</div>
		{/if}

		<EditButton
			onclick={() => {
				editingItemId = item.id;
				showEditModal = true;
			}}
		/>
		<ul class="flex space-x-4 sm:mt-0"></ul>
		<!-- what's this?-->
	</div>
</div>

<!-- Edit Modal -->
<ItemModal
	bind:isVisible={showEditModal}
	type="edit"
	{editingItem}
	imgUrl={getItemImageUrl(editingItem, data.PB_URL)}
/>
