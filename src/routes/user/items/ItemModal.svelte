<script lang="ts">
	import {
		Modal,
		Button,
		Input,
		Label,
		Helper,
		Toggle,
		Img,
		Popover,
		Textarea,
		Checkbox,
	} from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import placeholderimg from '$lib/images/placeholder_img.png';
	import type { Item } from '$lib/types/models';
	import {
		ChevronRightOutline,
		QuestionCircleSolid,
	} from 'flowbite-svelte-icons';
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import { texts, ITEM_CATEGORIES } from '$lib/texts';
	import { compressImage } from '$lib/utils/imageUtils';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import type { ActionData } from './$types';

	interface Props {
		isVisible: boolean;
		type: 'add' | 'edit';
		editingItem?: Item | null;
		imgUrl?: string;
		previewUrl?: string;
		lastUrl?: string;
		form?: ActionData;
	}

	let {
		isVisible = $bindable(),
		type,
		editingItem,
		imgUrl,
		previewUrl,
		lastUrl,
		form
	}: Props = $props();

	let isAvailable = $derived(editingItem?.status === 'available' ? true : false);

	let selectedCategories = $state<string[]>([]);

	$effect(() => {
		if (isVisible) {
			selectedCategories = [...(editingItem?.categories ?? [])];
		} else {
			selectedCategories = [];
		}
	});

	function handleCategoryChange(e: Event) {
		const cb = e.target as HTMLInputElement;
		if (cb.checked) {
			if (selectedCategories.length >= 3) {
				cb.checked = false;
				return;
			}
			selectedCategories = [...selectedCategories, cb.value];
		} else {
			selectedCategories = selectedCategories.filter((c) => c !== cb.value);
		}
	}

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
			form = null;
			if (lastUrl) {
				URL.revokeObjectURL(lastUrl);
				lastUrl = undefined;
			}
		}
	});
</script>

<Modal bind:open={isVisible} size="xs">
	{#if form?.fail}
		<div class="variant-soft-error rounded-token mb-2 px-4 py-2">
			<CustomAlert type="error" message={form?.message} />
		</div>
	{/if}
	<form
		class="items-right flex flex-col space-y-6"
		action="?/{type === 'edit' ? 'update' : 'create'}"
		method="POST"
		enctype="multipart/form-data"
		use:enhance={async ({ formData }) => {
			const file = formData.get('itemImage');
			if (file instanceof File && file.size > 0 && file.type !== 'image/svg+xml') {
				const compressed = await compressImage(file);
				formData.set('itemImage', compressed, file.name);
			}
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
			<span
				>{type === 'edit'
					? texts.forms.changeImage
					: texts.forms.addImage}</span
			>
			<input
				type="file"
				id="with_helper"
				name="itemImage"
				class="mb-2 min-button bg-primary"
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
				placeholder={texts.forms.itemName}
				value={editingItem?.name ? editingItem.name : ''}
				autocomplete="off"
				required
			/>
		</Label>

		<Label class="space-y-2">
			<span>{texts.forms.description}</span>
			<Textarea
				name="itemDescription"
				class="w-full"
				placeholder={texts.forms.itemDescription}
				value={editingItem?.description ? editingItem.description : ''}
				autocomplete="off"
				required
			/>
		</Label>

		<!-- CATEGORIES -->
		<div class="space-y-2">
			<span class="text-sm font-medium">{texts.forms.itemCategories}</span>
			<div class="flex flex-wrap gap-x-4 gap-y-2">
				{#each ITEM_CATEGORIES as cat}
					<Label class="flex items-center gap-1.5 cursor-pointer font-normal">
						<Checkbox
							name="categories"
							value={cat}
							checked={selectedCategories.includes(cat)}
							disabled={selectedCategories.length >= 3 && !selectedCategories.includes(cat)}
							onchange={handleCategoryChange}
						/>
						{cat}
					</Label>
				{/each}
			</div>
		</div>

		<Label class="flex">
			<Toggle
				name="trusteesOnly"
				checked={editingItem?.trusteesOnly ? editingItem.trusteesOnly : false}
				>{texts.ui.trustedOnly}</Toggle
			>
			<div
				class="flex items-center text-sm font-light text-gray-500 dark:text-gray-400"
			>
				<button id="b4">
					<QuestionCircleSolid class="ml-1 h-full" />
					<span class="sr-only">{texts.ui.explainThis}</span>
				</button>
			</div>
		</Label>

		{#if type === 'edit'}
			<Label class="flex">
				<Toggle
					name="isAvailable"
					bind:checked={isAvailable}
					>{isAvailable ? texts.itemStatus.available : texts.itemStatus.unavailable}</Toggle
				>
				<div
					class="flex items-center text-sm font-light text-gray-500 dark:text-gray-400"
				>
					<button id="b4">
						<QuestionCircleSolid class="ml-1 h-full" />
						<span class="sr-only">{texts.ui.explainThis}</span>
					</button>
				</div>
			</Label>
		{/if}

		<!-- SUBMIT BUTTON -->
		<Button class="min-button bg-primary" type="submit">
			{type === 'edit' ? texts.buttons.save : texts.buttons.add}
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
			<Button class="min-button bg-danger" type="submit"
				>{texts.buttons.delete}</Button
			>
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
				href={resolve('/social')}
				class="text-accent hover:underline flex items-center font-medium"
			>
				Vertraute hinzufügen<ChevronRightOutline
					class="text-accent dark:text-primary-500 ms-1.5 h-4 w-4"
				/>
			</a>
		</div>
	</Popover>
</Modal>
