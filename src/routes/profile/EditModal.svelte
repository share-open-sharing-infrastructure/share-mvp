<script lang="ts">
    import { Modal, Button, Input, Label, Fileupload, Helper, Toggle } from 'flowbite-svelte';
    import { enhance } from '$app/forms';

    let { editModal = $bindable(), editingItemId, editingItem } = $props();
</script>

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