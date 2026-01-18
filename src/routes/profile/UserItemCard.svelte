<script lang="ts">
	import type { Item } from '$lib/types/models';
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

<div
	class="items-center bg-gray-50 rounded-lg shadow sm:flex dark:bg-gray-800 dark:border-gray-700"
>
	<img class="lg:w-40 h-40 rounded-lg" src={imgUrl} alt={item.name} />

	<div class="p-5">
		<h3 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
			{item.name}
		</h3>
		<span class="text-gray-500 dark:text-gray-400">{item.place}</span>
		<p class="mt-3 mb-4 font-light text-gray-500 dark:text-gray-400">{item.description}</p>
		<EditButton
			onclick={() => {
				editingItemId = item.id;
				showEditModal = true;
			}}
		/>
		<ul class="flex space-x-4 sm:mt-0"></ul>
	</div>
</div>

<!-- Edit Modal -->
<ItemModal
	bind:isVisible={showEditModal}
	type="edit"
	{editingItem}
	imgUrl={getItemImageUrl(editingItem, data.PB_URL)}
/>
