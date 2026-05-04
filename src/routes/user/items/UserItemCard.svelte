<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { Badge } from 'flowbite-svelte';
	import ItemModal from './ItemModal.svelte';
	import { texts } from '$lib/texts';

	interface Props {
		item: Item;
		imgUrl: string;
		PB_URL: string;
	}
	let { item, imgUrl, PB_URL }: Props = $props();
	let showEditModal = $state(false);

	function getItemImageUrl(item: Item, baseUrl: string): string {
		return `${baseUrl}api/files/${item?.collectionId}/${item?.id}/${item?.image}`;
	}
</script>

<button
	type="button"
	onclick={() => (showEditModal = true)}
	class="items-center border bg-papier hover:bg-sand  border-tinte-200 rounded-lg shadow flex sm:flex-row overflow-hidden w-full text-left cursor-pointer transition-colors"
>
	<div class="flex flex-col items-center m-5 w-30">

		<img
		class="w-30 h-30 object-cover aspect-square rounded-lg"
		src={imgUrl}
		alt={item.name}
		/>
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
	<div class="p-5 w-full min-w-0 h-full flex flex-col justify-between">
		<div>
			<h3
				class="text-l font-bold tracking-tight text-tinte-900 dark:text-white overflow-break-words"
			>
				{item.name}
			</h3>
			
		</div>
		<div class="text-sm line-clamp-2 text-tinte-500 dark:text-tinte-400 mt-2">
			{item.description}
		</div>

		<div class="flex items-center gap-2 justify-end pt-4">

				<span
					class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border
						{item.status === 'available'
							? 'bg-green-100 text-green-800 border-green-300'
							: 'bg-accent-100 text-accent-800 border-accent-300'}"
				>
					{item.status === 'available' ? texts.itemStatus.available : texts.itemStatus.unavailable}
				</span>
		</div>
	</div>
</button>

<!-- Edit Modal -->
<ItemModal
	bind:isVisible={showEditModal}
	type="edit"
	editingItem={item}
	imgUrl={getItemImageUrl(item, PB_URL)}
/>
