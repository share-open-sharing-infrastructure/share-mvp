<script>
	import { Button, Img, Modal, Label, Input, Fileupload, Helper } from 'flowbite-svelte';
	import { Section } from 'flowbite-svelte-blocks';

    let { data } = $props();

	let addModal = $state(false);

	let editModal = $state(false);
	let editingItemId = $state("");
	let editingItem = $derived(
		data.user.expand.items_via_field.find((item) => item.id === editingItemId)
	);
	
</script>

<!-- User meta data -->

<!-- Friend list? -->

<!-- User's items (although maybe that should be its own page) -->
<Section>
	<div class="flex flex-col items-center justify-center">
		<span class="text-2xl m-2 font-semibold text-gray-900 dark:text-white">Du verleihst...</span>
	</div>
	<div class="flex flex-col items-center mx-auto max-w-6xl space-y-2 p-4">

		{#each data.user.expand.items_via_field as item}
		<!-- This should be extracted into a component -->
			<div class="w-full max-w-2/4 border rounded-lg p-1">
				<!-- CONTENT -->
				<div class="flex p-1">
					<!-- IMAGE -->
					<div class="p-1 flex-shrink-0">
						<div class="h-24 w-24 overflow-hidden rounded-lg bg-gray-100">
							<Img
								src={`${data.PB_URL}api/files/${item.collectionId}/${item.id}/${item.image}`} alt={item.name} 
								class="h-full w-full object-cover"
								loading="lazy"
							/>
						</div>
					</div>

					<!-- DESCRIPTION -->
					<div class="p-1 px-2 border-l mx-2">
						<div class="text-lg font-bold p-1">
							{item.name}
						</div>
						<div class="p-1 my-2">
							{item.description}
						</div>
						<!-- <div class="p-1">
							<span class="font-semibold">Status:</span>
							<span class="border rounded-full bg-green-100 p-1 px-3 text-sm">Aktiv</span>
						</div> -->
					</div>

				</div>
				<!-- LENDING SCOPE -->
				<!-- <div class="flex p-1 overflow-auto">
					<span class="text-xs mr-2">Verleih an: </span>

					{#snippet lendingTag(tagName)}
						
						<div class="
							border rounded-full 
							p-1 px-2 mx-0.5 
							bg-blue-100 
							text-xs text-center">{tagName}</div>
					{/snippet}
					
					{@render lendingTag('Freunde')}
					{@render lendingTag('Freunde²')}
					{@render lendingTag('Öffentlich')}
					{@render lendingTag('Kegelverein')}
				</div> -->
				
				<!-- BUTTONS -->
				<div class="flex p-1">
					<Button 
						class="border p-1 w-full"
						onclick={() => {
							editingItemId = item.id;
							editModal = true;
						}}>
						Bearbeiten
					</Button>
				</div>
			</div>
		{/each}
	</div>
</Section>

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

<!-- MODALS AND STUFF -->

<!-- Add Modal -->


<!-- Edit Modal -->
<Modal form bind:open={editModal} size="xs">
	<form
		class="flex flex-col space-y-6"
		action="?/update"
		method="post"
	>
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
	<form method="POST" action="?/delete">
		<Input type="text" name="itemId" value={editingItemId} hidden />
		<Button
			class="bg-gray-800 text-white hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
			type="submit">Löschen</Button
		>
	</form>
</Modal>

<Modal form bind:open={addModal} size="xs">
	<form
		class="flex flex-col space-y-6"
		action="?/create"
		method="post"
		enctype="multipart/form-data"
	>
		<h3 class="mb-4 text-xl font-medium text-gray-900 dark:text-white">Details</h3>

		<Label class="space-y-2">
			<span>Bild hochladen</span>
			<Fileupload type="file" id="with_helper" name="image" class="mb-2" />
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