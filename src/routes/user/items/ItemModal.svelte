<script lang="ts">
	import {
		Modal,
		Button,
		Input,
		Label,
		Helper,
		Toggle,
		Img,
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
	import type { ActionData } from './$types';

	interface Props {
		isVisible: boolean;
		type: 'add' | 'edit';
		editingItem?: Item | null;
		imgUrl?: string;
		previewUrl?: string;
		lastUrl?: string;
		groups?: { id: string; name: string; isPublic?: boolean }[];
		form?: ActionData;
	}

	let {
		isVisible = $bindable(),
		type,
		editingItem,
		imgUrl,
		previewUrl,
		lastUrl,
		groups = [],
		form
	}: Props = $props();

	let isAvailable = $derived(editingItem?.status === 'available' ? true : false);

	let selectedCategories = $state<string[]>([]);
	let selectedGroups = $state<string[]>([]);
	let trusteesOn = $state(true);
	let showTrustInfo = $state(false);
	let showAvailabilityInfo = $state(false);

	$effect(() => {
		if (isVisible) {
			selectedCategories = [...(editingItem?.categories ?? [])];
			selectedGroups = [...(editingItem?.groups ?? [])];
			trusteesOn = editingItem?.trusteesOnly ?? true;
		} else {
			selectedCategories = [];
			selectedGroups = [];
		}
	});

	function toggleGroup(id: string, checked: boolean) {
		selectedGroups = checked
			? [...selectedGroups, id]
			: selectedGroups.filter((g) => g !== id);
	}

	// Trustees and groups are independent audiences; an item is public only when
	// neither is set.
	let isPublic = $derived(!trusteesOn && selectedGroups.length === 0);

	// A selected PUBLIC group means anyone can self-join and thus see this item —
	// warn the owner so sharing into a public group is a conscious choice.
	let anyPublicGroupSelected = $derived(
		groups.some((g) => g.isPublic && selectedGroups.includes(g.id))
	);

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
		<div class="mb-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
			<p>{form.message}</p>
			{#if form?.conversationIds?.length}
				<a
					href="/conversations/{form.conversationIds[0]}"
					class="mt-1 inline-block font-semibold underline"
				>{texts.pages.items.linkToConversation}</a>
			{/if}
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
		<Label class="space-y-2 mx-auto text-center">

			<input
				type="file"
				id="with_helper"
				name="itemImage"
				class="mb-2 min-button bg-primary-200"
				accept="image/*"
				onchange={handleFileChange}
			/>
			<Helper>Alle gängigen Bildformate</Helper>
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
				class="w-full h-30"
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
				{#each ITEM_CATEGORIES as cat(cat)}
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

		<!-- VISIBILITY: trustees and groups are independent audiences -->
		<Label class="flex">
			<Toggle
				name="trusteesOnly"
				classes={{ span: 'bg-primary-300 peer-checked:bg-safety' }}
				bind:checked={trusteesOn}
				>{texts.groups.itemTrusteesLabel}</Toggle
			>
			<!-- Click-toggled inline panel instead of a hover Popover — hover doesn't work on mobile. -->
			<div class="flex items-center text-sm font-light text-tinte-500 dark:text-tinte-400">
				<button type="button" onclick={() => showTrustInfo = !showTrustInfo}>
					<QuestionCircleSolid class="ml-1 h-full" />
					<span class="sr-only">{texts.ui.explainThis}</span>
				</button>
			</div>
		</Label>
		{#if showTrustInfo}
			<div class="rounded-lg border border-tinte-200 bg-sand p-3 text-sm text-tinte-500 space-y-1">
				<p class="font-semibold text-tinte-900">{texts.groups.trustInfoTitle}</p>
				<p>{texts.groups.trustInfoBody}</p>
				<a href={resolve('/social')} class="text-accent hover:underline flex items-center font-medium">
					{texts.groups.trustInfoAddLink}<ChevronRightOutline class="text-accent ms-1.5 h-4 w-4" />
				</a>
			</div>
		{/if}

		<!-- GROUP SHARING (independent of the trustees toggle) -->
		<div class="space-y-2 rounded-lg border border-tinte-200 bg-sand p-3">
			<span class="text-sm font-medium text-tinte-900">{texts.groups.itemShareTitle}</span>
			{#if groups.length === 0}
				<p class="text-sm text-tinte-500">{texts.groups.noGroupsForItem}</p>
				<a href={resolve('/user/groups')} class="text-accent hover:underline flex items-center font-medium text-sm">
					{texts.groups.goToGroups}<ChevronRightOutline class="text-accent ms-1.5 h-4 w-4" />
				</a>
			{:else}
				<p class="text-xs text-tinte-500">{texts.groups.itemShareHint}</p>
				<div class="flex flex-col gap-1.5">
					{#each groups as g (g.id)}
						<Label class="flex items-center gap-2 font-normal cursor-pointer">
							<Checkbox
								name="groups"
								value={g.id}
								checked={selectedGroups.includes(g.id)}
								onchange={(e) => toggleGroup(g.id, (e.target as HTMLInputElement).checked)}
							/>
							{g.name}
							{#if g.isPublic}
								<span class="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-800 dark:bg-primary-900 dark:text-primary-200">{texts.groups.publicBadge}</span>
							{/if}
						</Label>
					{/each}
				</div>
				{#if anyPublicGroupSelected}
					<p class="text-xs font-medium text-danger">{texts.groups.itemPublicGroupWarning}</p>
				{/if}
			{/if}
		</div>

		{#if isPublic}
			<p class="text-xs text-tinte-500">{texts.groups.itemPublicHint}</p>
		{/if}

		{#if type === 'edit'}
			<Label class="flex">
				<Toggle
					classes={{ span: 'bg-primary-300 peer-checked:bg-safety' }}
					name="isAvailable"
					bind:checked={isAvailable}
					>{isAvailable ? texts.itemStatus.available : texts.itemStatus.unavailable}</Toggle
				>
				<!-- Same click-toggle pattern as trust info above. -->
				<div class="flex items-center text-sm font-light text-tinte-500 dark:text-tinte-400">
					<button type="button" onclick={() => showAvailabilityInfo = !showAvailabilityInfo}>
						<QuestionCircleSolid class="ml-1 h-full" />
						<span class="sr-only">{texts.ui.explainThis}</span>
					</button>
				</div>
			</Label>
			{#if showAvailabilityInfo}
				<div class="rounded-lg border border-tinte-200 bg-sand p-3 text-sm text-tinte-500 space-y-1">
					<p class="font-semibold text-tinte-900">{texts.ui.availabilityTitle}</p>
					<p>{texts.ui.availabilityExplain}</p>
				</div>
			{/if}
		{/if}

		<!-- SUBMIT BUTTON -->
		<Button class="min-button bg-primary-200 hover:bg-primary" type="submit">
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
			<Button class="min-button bg-accent-200 hover:bg-danger" type="submit"
				>{texts.buttons.delete}</Button
			>
		</form>
	{/if}
</Modal>
