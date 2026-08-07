<script lang="ts">
	import {
		Modal,
		Input,
		Label,
		Toggle,
		Textarea,
		Checkbox,
	} from 'flowbite-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';
	import type { Item } from '$lib/types/models';
	import { QuestionCircleSolid } from 'flowbite-svelte-icons';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import { ITEM_CATEGORIES } from '$lib/categories';
	import { compressImage } from '$lib/utils/imageUtils';
	import { itemOwnFileUrls } from '$lib/utils/utils';
	import ItemImagePicker from './ItemImagePicker.svelte';
	import ItemVisibilityFields from './ItemVisibilityFields.svelte';
	import type { ActionData } from './$types';

	interface Props {
		isVisible: boolean;
		type: 'add' | 'edit';
		editingItem?: Item | null;
		/** Existing cover image URL, shown in edit mode until new files are chosen. */
		imgUrl?: string;
		/** PocketBase base URL — needed to build file URLs for an item's existing images. */
		pbUrl?: string;
		groups?: { id: string; name: string; isPublic?: boolean }[];
		form?: ActionData;
	}

	let {
		isVisible = $bindable(),
		type,
		editingItem,
		imgUrl,
		pbUrl,
		groups = [],
		form
	}: Props = $props();

	let isAvailable = $state(true);

	let selectedCategories = $state<string[]>([]);
	let selectedGroups = $state<string[]>([]);
	let trusteesOn = $state(true);
	let showAvailabilityInfo = $state(false);
	// Track edits so an accidental modal dismiss (backdrop / ESC / X) can warn before
	// discarding the user's input.
	let isDirty = $state(false);
	// Submit-time failure message, shown inline right above the submit button. A bottom
	// toast can't be used here: the Flowbite modal is a native <dialog> in the browser's
	// top layer, which paints above any z-indexed toast overlay (#522). Local (not the
	// shared page-level `form` prop) so it's scoped to THIS modal's own submit.
	let submitError = $state<string | null>(null);
	// In-flight guard against double-submit (slow connection + repeated taps firing
	// duplicate ?/create requests, #445). Mirrors the bulk-add ReviewStep pattern.
	let submitting = $state(false);
	// Newly chosen images, owned by ItemImagePicker; bound here for submit-time compression.
	let selectedFiles = $state<File[]>([]);
	// Images already saved on the item (edit mode), passed to the picker's display-only gallery.
	let existingImageUrls = $state<string[]>([]);

	$effect(() => {
		if (isVisible) {
			selectedCategories = [...(editingItem?.categories ?? [])];
			selectedGroups = [...(editingItem?.groups ?? [])];
			trusteesOn = editingItem?.trusteesOnly ?? true;
			isAvailable = editingItem?.status === 'available';
			isDirty = false;
			// Seed the existing-image gallery so editing an item with several photos shows
			// them all. Needs pbUrl to build the file URLs; empty for add / external-only items.
			existingImageUrls =
				pbUrl && editingItem?.image?.length ? itemOwnFileUrls(pbUrl, editingItem) : [];
		}
	});

	$effect(() => {
		if (!isVisible) {
			form = null;
			submitError = null;
			submitting = false;
		}
	});
</script>

<Modal
	title={type === 'edit' ? texts.pages.items.editTitle : texts.pages.items.addTitle}
	bind:open={isVisible}
	size="md"
	oncancel={(e: Event) => {
		if (isDirty && !confirm(texts.pages.items.unsavedLeaveConfirm)) {
			e.preventDefault();
		}
	}}
>
	<form
		class="flex flex-col gap-6 md:flex-row"
		action="?/{type === 'edit' ? 'update' : 'create'}"
		method="POST"
		enctype="multipart/form-data"
		oninput={() => (isDirty = true)}
		onchange={() => (isDirty = true)}
		use:enhance={async ({ formData, cancel }) => {
			if (submitting) { cancel(); return; }
			submitting = true;
			submitError = null;
			// Multi-file field: compress each chosen image and re-append under the same
			// `itemImage` key. SVGs skip compression (canvas can't draw them reliably);
			// anything the browser can't decode (e.g. iPhone HEIC) surfaces a clear error.
			formData.delete('itemImage');
			for (const file of selectedFiles) {
				if (file.type === 'image/svg+xml') {
					formData.append('itemImage', file, file.name);
					continue;
				}
				try {
					const compressed = await compressImage(file);
					formData.append('itemImage', compressed, file.name);
				} catch {
					submitError = texts.bulkUpload.imageFormatUnsupported;
					submitting = false;
					cancel();
					return;
				}
			}
			return async ({ result, update }) => {
				submitting = false;
				if (result.type === 'success') {
					isDirty = false;
					isVisible = false;
				} else if (result.type === 'failure') {
					// Show the failure inline right above the submit button (#522). Sourced
					// from this form's own result — not the shared page-level `form` prop,
					// which is fanned out to every row's modal and written by unrelated
					// inline/bulk actions — so it stays tied to *this* submit. A too-long
					// description gets its own message instead of the generic one (the client
					// maxlength normally prevents it; this covers a tampered/pasted submit).
					const data = result.data as
						| { message?: string; missingFields?: { descriptionTooLong?: boolean } }
						| undefined;
					submitError = data?.missingFields?.descriptionTooLong
						? texts.pages.items.descriptionTooLong
						: (data?.message ?? null);
				}
				await update();
			};
		}}
	>
		<!-- LEFT COLUMN: image preview(s) + upload (drag & drop / click) -->
		<ItemImagePicker
			bind:selectedFiles
			{existingImageUrls}
			{imgUrl}
			mode={type}
			itemName={editingItem?.name ?? ''}
			visible={isVisible}
			onDirty={() => (isDirty = true)}
		/>

		<!-- RIGHT COLUMN: item details -->
		<div class="flex flex-1 flex-col space-y-6">
			<Input type="text" name="itemId" value={editingItem?.id} hidden />

			<Label class="space-y-2">
				<span>{texts.forms.nameLabel}</span>
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
					class="h-30 w-full"
					placeholder={texts.forms.itemDescription}
					value={editingItem?.description ? editingItem.description : ''}
					autocomplete="off"
					maxlength={4000}
					required
				/>
			</Label>

			<!-- CATEGORIES -->
			<div class="space-y-2">
				<span class="text-sm font-medium">{texts.forms.itemCategories}</span>
				<div class="flex flex-wrap gap-x-4 gap-y-2">
					{#each ITEM_CATEGORIES as cat(cat)}
						<Label class="flex cursor-pointer items-center gap-1.5 font-normal">
							<Checkbox
								name="categories"
								value={cat}
								bind:group={selectedCategories}
								disabled={selectedCategories.length >= 3 && !selectedCategories.includes(cat)}
							/>
							{cat}
						</Label>
					{/each}
				</div>
			</div>

			<ItemVisibilityFields {groups} bind:trusteesOn bind:selectedGroups />

			{#if type === 'edit'}
				<div class="flex items-center">
					<Label class="flex">
						<Toggle
							classes={{ span: 'bg-primary-300 peer-checked:bg-safety' }}
							name="isAvailable"
							bind:checked={isAvailable}
							>{isAvailable ? texts.itemStatus.available : texts.itemStatus.unavailable}</Toggle
						>
					</Label>
					<!-- Same pattern: info button sits outside the <Label> so it can't flip the toggle. -->
					<button
						type="button"
						class="flex items-center text-sm font-light text-tinte-500 dark:text-tinte-400"
						onclick={() => (showAvailabilityInfo = !showAvailabilityInfo)}
					>
						<QuestionCircleSolid class="ml-1 h-full" />
						<span class="sr-only">{texts.ui.explainThis}</span>
					</button>
				</div>
				{#if showAvailabilityInfo}
					<div class="space-y-1 rounded-lg border border-tinte-200 bg-sand p-3 text-sm text-tinte-500">
						<p class="font-semibold text-tinte-900">{texts.ui.availabilityTitle}</p>
						<p>{texts.ui.availabilityExplain}</p>
					</div>
				{/if}
			{/if}

			<!-- Submit failure shown right where the user is looking (next to the button),
				 so it's never scrolled out of view like the old top-of-modal alert (#522). -->
			{#if submitError}
				<p
					class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
					role="alert"
				>
					{submitError}
				</p>
			{/if}

			<!-- SUBMIT BUTTON -->
			<Button type="submit" loading={submitting}>
				{type === 'edit' ? texts.buttons.save : texts.buttons.add}
			</Button>
		</div>
	</form>

	<!-- DELETE BUTTON -->
	{#if type === 'edit'}
		<!-- Delete-blocked alert sits by the delete button (not the modal top) so it's in
			 view right after the click, and carries the actionable conversation link. -->
		{#if form?.fail && form?.conversationIds?.length}
			<div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200" role="alert">
				<p>{form.message}</p>
				<a
					href={resolve('/conversations/[conversationId]', { conversationId: form.conversationIds[0] })}
					class="mt-1 inline-block font-semibold underline"
				>{texts.pages.items.linkToConversation}</a>
			</div>
		{/if}
		<form
			method="POST"
			action="?/delete"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						isDirty = false;
						isVisible = false;
					}
					await update();
				};
			}}
			class="mt-4 flex w-full justify-end"
		>
			<Input type="text" name="itemId" value={editingItem?.id} hidden />
			<Button variant="danger" type="submit">{texts.buttons.delete}</Button>
		</form>
	{/if}
</Modal>
