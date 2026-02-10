<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { Badge, Popover } from 'flowbite-svelte';
	import {
		ChevronRightOutline,
		MapPinOutline,
		QuestionCircleSolid,
	} from 'flowbite-svelte-icons';
	import EditButton from './EditButton.svelte';
	import ItemModal from './ItemModal.svelte';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';

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
			? data.user.expand.items_via_owner.find(
					(item: Item) => item.id === editingItemId
				)
			: null
	);
	function getItemImageUrl(item: Item, baseUrl: string): string {
		return `${baseUrl}api/files/${item?.collectionId}/${item?.id}/${item?.image}`;
	}
</script>

<div class="items-center border border-gray-200 rounded-lg shadow sm:flex">
	<img class="m-5 w-40 h-40 rounded-lg" src={imgUrl} alt={item.name} />

	<div class="p-5">
		<h3 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
			{item.name}
		</h3>
		<span class="flex items-center gap-1 text-sm">
			<MapPinOutline class="h-4 w-4" />
			{item.place}
		</span>
		{#if item.trusteesOnly}
			<div class="flex items-center">
				<Badge rounded border color="green" class="my-2">
					<span class="text-green-900 bg-green-100">{texts.ui.trustedOnly}</span
					>
				</Badge>
			</div>
		{/if}
		<p class="mt-3 mb-4 font-light text-gray-500 dark:text-gray-400">
			{item.description}
		</p>

		<EditButton
			onclick={() => {
				editingItemId = item.id;
				showEditModal = true;
			}}
		/>
	</div>
</div>

<!-- Edit Modal -->
<ItemModal
	bind:isVisible={showEditModal}
	type="edit"
	{editingItem}
	imgUrl={getItemImageUrl(editingItem, data.PB_URL)}
/>
