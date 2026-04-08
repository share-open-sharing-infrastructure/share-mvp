<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { Badge } from 'flowbite-svelte';
	import EditButton from './EditButton.svelte';
	import ItemModal from './ItemModal.svelte';
	import { texts } from '$lib/texts';
	import { enhance } from '$app/forms';

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

		<div class="flex items-center gap-2 justify-end pt-4">
			<form method="POST" action="?/toggleStatus" use:enhance>
				<input type="hidden" name="itemId" value={item.id} />
				<button
					type="submit"
					class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border transition-colors cursor-pointer
						{item.status === 'available'
							? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
							: 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'}"
					title={item.status === 'available'
						? texts.itemStatus.markUnavailable
						: texts.itemStatus.markAvailable}
				>
					{item.status === 'available' ? texts.itemStatus.available : texts.itemStatus.unavailable}
				</button>
			</form>
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
