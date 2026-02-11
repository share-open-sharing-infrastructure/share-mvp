<script lang="ts">
	import type { Item } from '$lib/types/models';

	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import UserItemCard from './UserItemCard.svelte';
	import ItemModal from './ItemModal.svelte';
	import AddButton from './AddButton.svelte';

	let { data, form } = $props();

	let showAddModal = $state(false);

	function getItemImageUrl(item: Item, baseUrl: string): string {
		return `${baseUrl}api/files/${item?.collectionId}/${item?.id}/${item?.image}`;
	}
</script>

<section class="bg-white dark:bg-gray-900 min-h-screen">
	<div class="max-w-7xl mx-auto px-4 pt-6">
		{#if form?.fail}
			<div class="variant-soft-error rounded-token mb-2 px-4 py-2">
				<CustomAlert type="error" message={form?.message} />
			</div>
		{/if}

		<h1
			class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-20 mb-6"
		>
			Du verleihst
			{#if data?.user?.expand?.items_via_owner?.length}
				<span class="primary-text"
					>{data.user.expand.items_via_owner.length}</span
				> Ding(e)...
			{:else}
				noch keine Ding(e)...
			{/if}
		</h1>

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
			{#if data?.user?.expand?.items_via_owner?.length}
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
			{/if}
		</div>
	</div>
</section>

<!-- Add Modal -->
<ItemModal bind:isVisible={showAddModal} type="add" />
