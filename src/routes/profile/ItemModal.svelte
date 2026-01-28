<script lang="ts">
	import {
		Modal,
		Button,
		Input,
		Label,
		Fileupload,
		Helper,
		Toggle,
		Img
	} from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import placeholderimg from '$lib/images/placeholder_img.png';
	import type { Item } from '$lib/types/models';
	import { onDestroy } from 'svelte';

	interface Props {
		isVisible: boolean;
		type: 'add' | 'edit';
		editingItem?: Item | null;
		imgUrl?: string;
		previewUrl?: string;
		lastUrl?: string;
	}

	let { isVisible = $bindable(), type, editingItem, imgUrl, previewUrl, lastUrl }: Props = $props();

	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (file) {
		if (lastUrl) URL.revokeObjectURL(lastUrl);
		lastUrl = URL.createObjectURL(file);
		previewUrl = lastUrl;
		}
	}

	$effect(() => {
		if(isVisible) {
			if (!previewUrl && !imgUrl) {
				previewUrl = placeholderimg;
			}
		}
	});


	onDestroy(() => {
		if (lastUrl) URL.revokeObjectURL(lastUrl);
	});
</script>


<Modal bind:open={isVisible} size="xs">
	<form
		class="items-right flex flex-col space-y-6"
		action="?/{type === 'edit' ? 'update' : 'create'}"
		method="POST"
		enctype="multipart/form-data"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') {
					isVisible = false;
				}
				await update();
			};
		}}
	>
			<Input type="text" name="itemId" value={editingItem?.id} hidden />
			<Img
				src={previewUrl ?? imgUrl ?? placeholderimg}
				class="mx-auto h-50 w-50 rounded-md object-cover p-5"
			/>
		<Label class="space-y-2">
			<span>{type === 'edit' ? 'Bild ändern:' : 'Bild hinzufügen:'}</span>
			<input type="file" id="with_helper" name="itemImage" class="mb-2 min-button" accept="image/*" onchange={handleFileChange}
			/>
			<Helper>SVG, PNG, JPG or GIF (max. 800x400px).</Helper>
		</Label>

		<Label class="space-y-2">
			<span>Name:</span>
			<Input	
				type="text"
				name="itemName"
				placeholder="Name des Gegenstands"
				value={editingItem?.name ? editingItem.name : ''}
				autocomplete="off"
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
				autocomplete="off"
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
			class="min-button"
			type="submit"
		>
			{type === 'edit' ? 'Speichern' : 'Hinzufügen'}
		</Button>
	</form>
	{#if type === 'edit'}
		<form
			method="POST"
			action="?/delete"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						isVisible = false;
					}
					await update();
				};
			}}
			class="mt-4 flex w-full justify-end"
		>
			<Input type="text" name="itemId" value={editingItem?.id} hidden />
			<Button class="min-button" type="submit">Löschen</Button>
		</form>
	{/if}
</Modal>
