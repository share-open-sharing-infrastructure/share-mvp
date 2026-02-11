<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { Badge } from 'flowbite-svelte';
	import EditButton from './EditButton.svelte';
	import ItemModal from './ItemModal.svelte';
	import { texts } from '$lib/texts';

	interface Props {
		item: Item;
		imgUrl: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

<div
	class="items-center border border-gray-200 rounded-lg shadow flex sm:flex-row overflow-hidden"
>
	<img
		class="m-5 w-30 h-30 aspect-square rounded-lg"
		src={imgUrl}
		alt={item.name}
	/>

	<div class="p-5 w-full min-w-0 h-full flex flex-col justify-between">
		<div>
			<h3
				class="text-l font-bold tracking-tight text-gray-900 dark:text-white overflow-break-words"
			>
				{item.name}
			</h3>
			<!-- <span class="flex items-center gap-1 text-sm">
				<MapPinOutline class="h-4 w-4" />
				{item.place}
			</span> -->
			{#if item.trusteesOnly}
				<div class="flex items-center truncate">
					<Badge rounded border color="green" class="my-2">
						<span class="text-green-900 bg-green-100"
							>{texts.ui.trustedOnly}</span
						>
					</Badge>
				</div>
			{/if}
		</div>

		<div class="flex justify-end pt-4">
			<EditButton
				onclick={() => {
					editingItemId = item.id;
					showEditModal = true;
				}}
			/>
		</div>
	</div>
</div>

<!-- Edit Modal -->
<ItemModal
	bind:isVisible={showEditModal}
	type="edit"
	{editingItem}
	imgUrl={getItemImageUrl(editingItem, data.PB_URL)}
/>
