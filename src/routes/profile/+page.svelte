<script>
	import { Button, Modal, Label, Input, Fileupload, Helper, Alert, Toggle } from 'flowbite-svelte';
	import { Section } from 'flowbite-svelte-blocks';
	import UserItemCard from './UserItemCard.svelte';
	import { enhance } from '$app/forms';

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
<Modal bind:open={addModal} size="xs">
	<form
		class="flex flex-col space-y-6"
		action="?/create"
		method="post"
		enctype="multipart/form-data"
		use:enhance
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
		<Label class="space-y-2">
			<Toggle name="trusteesOnly">Nur an Vertraute verleihen</Toggle>
		</Label>
		<Button
			class="bg-gray-800 text-white hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
			type="submit"
			onclick={() => {
				addModal = false;
			}}>Gegenstand hinzufügen</Button
		>
	</form>
</Modal>

<!-- Edit Modal -->
<Modal bind:open={editModal} size="xs">
	<form
		class="items-right flex flex-col space-y-6"
		action="?/update"
		method="POST"
		enctype="multipart/form-data"
		use:enhance
	>
		<Label class="space-y-2">
			<span>Bild ändern</span>
			<Fileupload type="file" id="with_helper" name="image" class="mb-2" />
			<Helper>SVG, PNG, JPG or GIF (max. 800x400px).</Helper>
		</Label>
		<Input type="text" name="itemId" value={editingItemId} hidden />
		<Label class="space-y-2">
			<span>Name:</span>
			<Input
				type="text"
				name="itemName"
				placeholder="Name des Gegenstands"
				value={editingItem.name}
				required
			/>
		</Label>
		<Label class="space-y-2">
			<span>Beschreibung:</span>
			<Input
				type="text"
				name="itemDescription"
				placeholder="Beschreibung des Gegenstands"
				value={editingItem.description}
				required
			/>
		</Label>
		<Label class="space-y-2">
			<span>Ort:</span>
			<Input
				type="text"
				name="itemPlace"
				placeholder="Ort des Gegenstands"
				value={editingItem.place}
				required
			/>
		</Label>
		<Label class="space-y-2">
			<Toggle name="trusteesOnly" checked={editingItem.trusteesOnly}>Nur an Vertraute</Toggle>
		</Label>
		<Button
			class="bg-gray-800 text-white hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
			type="submit"
			onclick={() => {
				editModal = false;
			}}>Speichern</Button
		>
	</form>
	<form method="POST" action="?/delete" use:enhance class="mt-4 flex w-full justify-end">
		<Input type="text" name="itemId" value={editingItemId} hidden />
		<Button
			class=""
			type="submit"
			onclick={() => {
				editModal = false;
			}}>Löschen</Button
		>
	</form>
</Modal>
