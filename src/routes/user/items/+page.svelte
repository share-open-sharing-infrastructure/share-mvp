<script lang="ts">
	import type { Item } from '$lib/types/models';

	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import UserItemCard from './UserItemCard.svelte';
	import ItemModal from './ItemModal.svelte';
	import { Button } from 'flowbite-svelte';
	import { texts } from '$lib/texts';

	let { data, form } = $props();

	let showAddModal = $state(false);

	function getItemImageUrl(item: Item, baseUrl: string): string {
		return `${baseUrl}api/files/${item?.collectionId}/${item?.id}/${item?.image}`;
	}
</script>

<!-- HEADER -->
<div class="px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center">
		<h2
			class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white"
		>
			{texts.pages.items.title}
		</h2>
		<div>
			Du verleihst
			{#if data?.user?.expand?.items_via_owner?.length}
				<span class="text-accent"
					>{data.user.expand.items_via_owner.length}</span
				> Ding(e)...
			{:else}
				noch keine Ding(e)...
			{/if}

		</div>
	</div>
</div>

<section class="bg-white dark:bg-gray-900 min-h-screen">
	<div class="max-w-7xl mx-auto px-4 pt-6">

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
			<Button
				onclick={() => {
					showAddModal = true;
				}}
				class="min-button bg-primary-50">Ding hinzufügen...</Button
			>
			{#if data?.user?.expand?.items_via_owner?.length}
				{#each data.user.expand.items_via_owner as item (item.id)}
					<UserItemCard
						{item}
						{data}
						imgUrl={getItemImageUrl(item, data.PB_URL)}
					/>
				{/each}
			{/if}
			<!-- {#if data?.user?.expand?.items_via_owner?.length}
				{#each data.user.expand.items_via_owner as item (item.id)}
					<UserItemCard
						{item}
						{data}
						imgUrl={getItemImageUrl(item, data.PB_URL)}
					/>
				{/each}

				<AddButton
					onclick={(): void => {
						showAddModal = true;
					}}
					floating={true}
				/>
			{:else}
				<div
					class="flex flex-col items-center text-center text-gray-500 col-span-full py-12"
				>
					<p>Bisher verleihst du noch keine Gegenstände.</p>
					<AddButton
						onclick={(): void => {
							showAddModal = true;
						}}
						floating={false}
					/>
				</div>
			{/if} -->
		</div>
	</div>
</section>

<!-- Add Modal -->
<ItemModal bind:isVisible={showAddModal} type="add" form={form} />
