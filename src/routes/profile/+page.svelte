<script>
	import { Button, Modal, Label, Input, Fileupload, Helper, Alert, Card, Gallery } from 'flowbite-svelte';
	import { Section } from 'flowbite-svelte-blocks';
	import UserItemCard from './UserItemCard.svelte';

    let { data, form } = $props();

	let addModal = $state(false);

	let editModal = $state(false);
	let editingItemId = $state("");
	let editingItem = $derived(
		data?.user?.expand?.items_via_field
            ? data.user.expand.items_via_field.find((item) => item.id === editingItemId)
            : undefined
	);
	
</script>

<!-- User meta data -->

<!-- Friend list? -->

<!-- User's items (although maybe that should be its own page) -->
<Section>
	<div class="flex flex-col items-center justify-center">
		<span class="text-2xl m-2 font-semibold text-gray-900 dark:text-white">Du verleihst...</span>
	</div>
	<Gallery class="flex flex-col max-w-3xl mx-auto items-center">
		{#if form?.fail}
			<div class="variant-soft-error rounded-token mb-2 px-4 py-2">
				<Alert>
					<span class="font-medium">
						{form.message}
					</span>
				</Alert>
			</div>
		{/if}
		{#if data?.user?.expand?.items_via_field?.length}
			{#each data.user.expand.items_via_field as item}
				<Card class="border rounded-lg mb-4 max-w-1/2">
					<UserItemCard
						item={item}
						imgUrl={`${data.PB_URL}api/files/${item.collectionId}/${item.id}/${item.image}`} 
					/>
					
					<!-- BUTTONS -->
					<div class="flex p-1">
						<Button
							class="
								border 
								p-1 
								w-full 
								bg-gray-800 text-white 
								hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
							onclick={() => {
								editingItemId = item.id;
								editModal = true;
							}}>
							Bearbeiten
						</Button>
					</div>
				</Card>
			{/each}
			<Button
				onclick={() => {addModal = true}}
				class="
					fixed               /* take it out of the normal flow */
					bottom-10 right-10    /* position in the corner */
					z-50                /* above other content */
					rounded-full
					shadow-lg
					w-10
					h-10
					focus:ring-4 focus:ring-gray-300
					text-lg
				"
				>
			+
			</Button>
		{:else}
			<div class="flex flex-col items-center text-center text-gray-500">
				<p>Bisher verleihst du noch keine Gegenstände.</p>
				<Button
					onclick={() => {addModal = true}}
					class="
						z-50                /* above other content */
						rounded-full
						shadow-lg
						w-10
						h-10
						focus:ring-4 focus:ring-gray-300
						text-lg
					"
					>
				+
				</Button>
			</div>
		{/if}
	</Gallery>
</Section>



<!-- MODALS AND STUFF -->

<!-- ADD Modal -->
<Modal bind:open={addModal} size="xs">
	<form
		class="flex flex-col space-y-6"
		action="?/create"
		method="post"
		enctype="multipart/form-data"
	>
		<h3 class="mb-4 text-xl font-medium text-gray-900 dark:text-white">Details</h3>

		<Label class="space-y-2">
			<span>Bild hochladen</span>
			<Fileupload type="file" id="with_helper" name="image" class="mb-2" required />
			<Helper>SVG, PNG, JPG or GIF (max. 800x400px).</Helper>
		</Label>
		<Label class="space-y-2">
			<span>Name</span>
			<Input type="text" name="name" placeholder="Name des Gegenstands" required />
		</Label>
		<Label class="space-y-2">
			<span>Beschreibung</span>
			<Input type="text" name="description" placeholder="Beschreibung des Gegenstands" required />
		</Label>
		<Label class="space-y-2">
			<span>Ort</span>
			<Input type="text" name="place" placeholder="Ort des Gegenstands" required />
		</Label>
		<Button
			class="bg-gray-800 text-white hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
			type="submit">Gegenstand hinzufügen</Button
		>
	</form>
</Modal>

<!-- EDIT Modal -->
<Modal bind:open={editModal} size="xs">
	<form
		class="flex flex-col space-y-6 items-right" 
		action="?/update"
		method="post"
		enctype="multipart/form-data"
	>
		<Label class="space-y-2">
			<span>Bild ändern</span>
			<Fileupload type="file" id="with_helper" name="image" class="mb-2" />
			<Helper>SVG, PNG, JPG or GIF.</Helper>
		</Label>
		<Input type="text" name="itemId" value={editingItemId} hidden />
		<Label class="space-y-2">
			<span>Name:</span>
			<Input type="text" name="itemName" placeholder="Name des Gegenstands" value={editingItem.name} required />
		</Label>
		<Label class="space-y-2">
			<span>Beschreibung:</span>
			<Input type="text" name="itemDescription" placeholder="Beschreibung des Gegenstands" value={editingItem.description} required  />
		</Label>
		<Label class="space-y-2">
			<span>Ort:</span>
			<Input type="text" name="itemPlace" placeholder="Ort des Gegenstands" value={editingItem.place} required  />
		</Label>
		<Button
			class="bg-gray-800 text-white hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
			type="submit">Speichern</Button
		>
	</form>
	<form method="POST" action="?/delete" class="w-full flex justify-end mt-4">
		<Input type="text" name="itemId" value={editingItemId} hidden />
		<Button
			class=""
			type="submit">Löschen</Button
		>
	</form>
</Modal>
