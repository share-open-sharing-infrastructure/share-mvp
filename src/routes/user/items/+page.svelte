<script lang="ts">
	import type { Item } from '$lib/types/models';

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
			class="text-2xl tracking-tight font-extrabold text-tinte-900 dark:text-white"
		>
			{texts.pages.items.title}
		</h2>
		<div>
			{#if data?.items?.length}
				<span class="text-accent">{texts.pages.items.countSome(data.items.length)}</span>
			{:else}
				{texts.pages.items.countNone}
			{/if}
		</div>
	</div>
</div>

<section class="bg-secondary-100 dark:bg-tinte-900 min-h-screen">
	<div class="max-w-7xl mx-auto px-4 pt-6">

		<!-- Action buttons -->
		<div class="flex flex-col sm:flex-row gap-4 mb-8">
			<Button
				onclick={() => { showAddModal = true; }}
				class="flex-1 cursor-pointer flex items-center justify-center gap-2 py-3 text-base font-semibold rounded-xl shadow-sm border border-primary-200 bg-primary-50 hover:bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-100 dark:border-primary-700"
			>
				<span class="text-xl">📦</span>
				{texts.pages.items.addSingle}
			</Button>
			<Button
				href="/user/items/bulk-add"
				class="flex-1 flex items-center justify-center gap-2 py-3 text-base font-semibold rounded-xl shadow-sm border border-secondary-200 bg-secondary-50 hover:bg-secondary-100 text-secondary-800 dark:bg-secondary-900 dark:text-secondary-100 dark:border-secondary-700"
			>
				<span class="text-xl">✨</span>
				{texts.pages.items.addBulk}
			</Button>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
			{#if data?.items?.length}
				{#each data.items as item (item.id)}
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
