<script lang="ts">
    import { Modal, Button, Input, Label, Fileupload, Helper, Toggle } from 'flowbite-svelte';
    import { enhance } from '$app/forms';

    let { addModal = $bindable() } = $props();
</script>

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