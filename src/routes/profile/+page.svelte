<script>
	import { Button, Alert } from 'flowbite-svelte';
	import { Section } from 'flowbite-svelte-blocks';
	import UserItemCard from './UserItemCard.svelte';
	import AddModal from './AddModal.svelte';
	import EditModal from './EditModal.svelte';
	import ItemModal from './ItemModal.svelte';

	let { data, form } = $props();

	let addModal = $state(false);

	let editModal = $state(false);
	let editingItemId = $state('');
	let editingItem = $derived(
		data?.user?.expand?.items_via_owner
			? data.user.expand.items_via_owner.find((item) => item.id === editingItemId)
			: undefined
	);
</script>

<!-- User's items (although maybe that should be its own page) -->
<Section class="">
	<div class="mb-6 flex flex-col items-center justify-center">
		<span class="m-2 text-2xl font-semibold text-gray-900 dark:text-white"
			>Hi {data.user.username}!</span
		>
		<span>Du verleihst...</span>
	</div>
	<div class="mx-auto max-w-6xl items-center">
		{#if form?.fail}
			<div class="variant-soft-error rounded-token mb-2 px-4 py-2">
				<Alert>
					<span class="font-medium">
						{form.message}
					</span>
				</Alert>
			</div>
		{/if}
		{#if data?.user?.expand?.items_via_owner?.length}
			{#each data.user.expand.items_via_owner as item}
				<div
					class="mx-auto mb-4 w-full
					rounded-lg border md:w-2/3 lg:w-1/2
					"
				>
					<UserItemCard
						{item}
						imgUrl={`${data.PB_URL}api/files/${item.collectionId}/${item.id}/${item.image}`}
					/>

					<!-- BUTTONS -->
					<div class="flex p-1">
						<Button
							class="
								w-full
								border
								bg-gray-800 
								p-1 text-white 
								hover:bg-gray-900
								focus:ring-4 focus:ring-gray-300 focus:outline-none 
								dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
							onclick={() => {
								editingItemId = item.id;
								editModal = true;
							}}
						>
							Bearbeiten
						</Button>
					</div>
				</div>
			{/each}
			<Button
				onclick={() => {
					addModal = true;
				}}
				class="
					/*               take it out of the normal flow */ /*
					position in    the corner */ /* above other
					content                */ fixed right-10 bottom-10 z-50
					h-10
					w-10
					rounded-full
					text-lg
					shadow-lg focus:ring-4
					focus:ring-gray-300
				"
			>
				+
			</Button>
		{:else}
			<div class="flex flex-col items-center text-center text-gray-500">
				<p>Bisher verleihst du noch keine Gegenstände.</p>
				<Button
					onclick={() => {
						addModal = true;
					}}
					class="
						/*                above other content */ z-50
						h-10
						w-10
						rounded-full
						text-lg
						shadow-lg focus:ring-4
						focus:ring-gray-300
					"
				>
					+
				</Button>
			</div>
		{/if}
	</div>
</Section>

<!-- MODALS AND STUFF -->


<!-- Add Modal -->
<AddModal bind:addModal={addModal} />

<!-- Edit Modal -->
<EditModal bind:editModal={editModal} {editingItemId} {editingItem} />