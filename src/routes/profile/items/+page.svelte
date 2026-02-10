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

<section class="bg-white dark:bg-gray-900">
	<div class="max-w-7xl mx-auto">
		<div
			class="grid grid-cols-1 px-4 pt-6 xl:grid-cols-2 xl:gap-4 dark:bg-gray-900"
		>

			<!-- BODY -->
			<div class="col-span-full">

				<!-- ITEMS -->
				<div class="col-span-2">
					{#if form?.fail}
						<div class="variant-soft-error rounded-token mb-2 px-4 py-2">
							<CustomAlert type="error" message={form?.message} />
						</div>
					{/if}

					<div class="mb-4 col-span-full xl:mb-2">
						<h1
							class="text-xl font-semibold text-gray-900 sm:text-2xl mt-20 mb-6"
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
					</div>
					<div class="grid gap-8 mb-2 lg:mb-16 md:grid-cols-2 grid-cols-1">
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
							<div class="flex flex-col items-center text-center text-gray-500">
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
			</div>
		</div>
	</div>
</section>

<!-- Add Modal -->
<ItemModal bind:isVisible={showAddModal} type="add" />
