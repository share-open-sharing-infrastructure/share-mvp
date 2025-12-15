<script lang="ts">
	import { Modal, Button, Input, Label, Fileupload, Helper, Toggle, Img, img } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import type { Item } from '$lib/types/models';

	interface Props {
		isVisible: boolean;
		type: 'add' | 'edit';
		editingItem?: Item | null;
		imgUrl?: string;
	}
	
	let { isVisible = $bindable(), type, editingItem, imgUrl }: Props = $props();
</script>

<Modal bind:open={isVisible} size="xs">
	<form
		class="items-right flex flex-col space-y-6"
		action="?/{type === 'edit' ? 'update' : 'create'}"
		method="POST"
		enctype="multipart/form-data"
		use:enhance
	>
		<Img 
			src={imgUrl ? imgUrl : '/placeholder-image.png'}
			class="mx-auto h-48 w-full rounded-md object-cover p-5"
			>
		</Img>
		<Label class="space-y-2">
			<span>{type === 'edit' ? 'Bild ändern' : 'Bild hinzufügen'}</span>
			<Fileupload type="file" id="with_helper" name="itemImage" class="mb-2" />
			<Helper>SVG, PNG, JPG or GIF (max. 800x400px).</Helper>
		</Label>
		{#if type === 'edit'}
			<Input type="text" name="itemId" value={editingItem?.id} hidden />
		{/if}
		<Label class="space-y-2">
			<span>Name:</span>
			<Input
				type="text"
				name="itemName"
				placeholder="Name des Gegenstands"
				value={editingItem?.name ? editingItem.name : ''}
				required
			/>
		</Label>
		<Label class="space-y-2">
			<span>Beschreibung:</span>
			<Input
				type="text"
				name="itemDescription"
				placeholder="Beschreibung des Gegenstands"
				value={editingItem?.description ? editingItem.description : ''}
				required
			/>
		</Label>
		<Label class="space-y-2">
			<span>Ort:</span>
			<Input
				type="text"
				name="itemPlace"
				placeholder="Ort des Gegenstands"
				value={editingItem?.place ? editingItem.place : ''}
				required
			/>
		</Label>
		<Label class="space-y-2">
			<Toggle
				name="trusteesOnly"
				checked={editingItem?.trusteesOnly ? editingItem.trusteesOnly : false}
				>Nur an Vertraute</Toggle
			>
		</Label>
		<Button
			class="bg-gray-800 text-white hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
			type="submit"
			onclick={() => {
				isVisible = false;
			}}
		>
			{type === 'edit' ? 'Speichern' : 'Hinzufügen'}
		</Button>
	</form>
	{#if type === 'edit'}
		<form method="POST" action="?/delete" use:enhance class="mt-4 flex w-full justify-end">
			<Input type="text" name="itemId" value={editingItem?.id} hidden />
			<Button
				type="submit"
				onclick={() => {
					isVisible = false;
				}}>Löschen</Button
			>
		</form>
	{/if}
</Modal>
