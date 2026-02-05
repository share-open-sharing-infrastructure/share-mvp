<script lang="ts">
	import {
		Modal,
		Button,
		Input,
		Label,
		Fileupload,
		Helper,
		Toggle,
		Img,
		Popover,
	} from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import placeholderimg from '$lib/images/placeholder_img.png';
	import type { Item } from '$lib/types/models';
	import {
		ChevronRightOutline,
		QuestionCircleSolid,
	} from 'flowbite-svelte-icons';
	import { onDestroy } from 'svelte';

	interface Props {
		isVisible: boolean;
		type: 'add' | 'edit';
		editingItem?: Item | null;
		imgUrl?: string;
		previewUrl?: string;
		lastUrl?: string;
	}

	let {
		isVisible = $bindable(),
		type,
		editingItem,
		imgUrl,
		previewUrl,
		lastUrl,
	}: Props = $props();

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
		if (isVisible) {
			if (!previewUrl && !imgUrl) {
				previewUrl = placeholderimg;
			}
		}
	});

	onDestroy(() => {
		if (lastUrl) URL.revokeObjectURL(lastUrl);
	});

	$effect(() => {
		if (!isVisible) {
			previewUrl = undefined;
			if (lastUrl) {
				URL.revokeObjectURL(lastUrl);
				lastUrl = undefined;
			}
		}
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

		<!-- IMAGE PREVIEW -->
		<Img
			src={previewUrl ?? imgUrl ?? placeholderimg}
			class="mx-auto h-50 w-50 rounded-md object-cover p-5"
		/>
		<Label class="space-y-2">
			<span>{type === 'edit' ? 'Bild ändern:' : 'Bild hinzufügen:'}</span>
			<input
				type="file"
				id="with_helper"
				name="itemImage"
				class="mb-2 min-button"
				accept="image/*"
				onchange={handleFileChange}
			/>
			<Helper>SVG, PNG, JPG or GIF (max. 800x400px).</Helper>
		</Label>

		<!-- ITEM DETAILS -->
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
		<Label class="flex">
			<Toggle
				name="trusteesOnly"
				checked={editingItem?.trusteesOnly ? editingItem.trusteesOnly : false}
				>Nur an Vertraute</Toggle
			>
			<div
				class="flex items-center text-sm font-light text-gray-500 dark:text-gray-400"
			>
				<button id="b4">
					<QuestionCircleSolid class="ml-1 h-full" />
					<span class="sr-only">Erkläre mir das</span>
				</button>
			</div>
		</Label>

		<!-- SUBMIT BUTTON -->
		<Button class="min-button" type="submit">
			{type === 'edit' ? 'Speichern' : 'Hinzufügen'}
		</Button>
	</form>

	<!-- DELETE BUTTON -->
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
	<Popover
		triggeredBy="#b4"
		class="w-72 bg-white text-sm font-light text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
		placement="top-start"
	>
		<div class="space-y-2 p-3">
			<h3 class="font-semibold text-gray-900 dark:text-white">
				Vertrauensfunktion
			</h3>
			Wenn du diese Option aktivierst, ist der Gegenstand nur für deine vertrauten
			Kontakte sichtbar.
			<a
				href="/social"
				class="text-primary-600 dark:text-primary-500 dark:hover:text-primary-600 hover:text-primary-700 flex items-center font-medium"
			>
				Vertraute hinzufügen<ChevronRightOutline
					class="text-primary-600 dark:text-primary-500 ms-1.5 h-4 w-4"
				/>
			</a>
		</div>
	</Popover>
</Modal>
