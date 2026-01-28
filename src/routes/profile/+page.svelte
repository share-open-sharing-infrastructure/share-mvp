<script lang="ts">
	import { Alert } from 'flowbite-svelte';
	import UserItemCard from './UserItemCard.svelte';
	import ItemModal from './ItemModal.svelte';
	import type { Item } from '$lib/types/models';
	import AddButton from './AddButton.svelte';

	let { data, form } = $props();

	let showAddModal = $state(false);

	function getItemImageUrl(item: Item, baseUrl: string): string {
		return `${baseUrl}api/files/${item?.collectionId}/${item?.id}/${item?.image}`;
	}
</script>

<section class="bg-white dark:bg-gray-900">
	{#if form?.fail}
		<div class="variant-soft-error rounded-token mb-2 px-4 py-2">
			<Alert>
				<span class="font-medium">
					{form.message}
				</span>
			</Alert>
		</div>
	{/if}
	<div class="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 lg:px-6">
		<div class="mx-auto max-w-screen-sm text-center mb-8 lg:mb-16">
			<h2 class="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
				Hi {data.user.username}!
			</h2>
			<p class="font-light text-gray-500 lg:mb-16 sm:text-xl dark:text-gray-400">Du verleihst...</p>
			{#if !data?.user?.expand?.items_via_owner?.length}
				<p class="text-sm my-2">Noch garnichts! Füge etwas hinzu :)</p>
				<AddButton
					onclick={() => {
						showAddModal = true;
					}}
					floating={false}
				/>
			{/if}
		</div>
		<div class="grid gap-8 mb-6 lg:mb-16 md:grid-cols-2">
			{#if data?.user?.expand?.items_via_owner?.length}
				{#each data.user.expand.items_via_owner as item}
					<UserItemCard {item} {data} imgUrl={getItemImageUrl(item, data.PB_URL)} />
				{/each}
				<AddButton
					onclick={() => {
						showAddModal = true;
					}}
					floating={true}
				/>
			{/if}
		</div>
	</div>
	<div class="mx-auto">
		
		
	</div>
</section>

<!-- Add Modal -->
<ItemModal bind:isVisible={showAddModal} type="add" />
