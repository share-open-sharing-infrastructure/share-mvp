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
	import { texts } from '$lib/texts';
	import { ITEM_CATEGORIES } from '$lib/categories';
	import { compressImage } from '$lib/utils/imageUtils';
	import { itemOwnFileUrls } from '$lib/utils/utils';
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

	let isAvailable = $derived(editingItem?.status === 'available' ? true : false);

	let selectedCategories = $state<string[]>([]);
	let selectedGroups = $state<string[]>([]);
	let trusteesOn = $state(true);
	let showTrustInfo = $state(false);
	let showAvailabilityInfo = $state(false);
	// Track edits so an accidental modal dismiss (backdrop / ESC / X) can warn before
	// discarding the user's input.
	let isDirty = $state(false);
	let imageError = $state<string | null>(null);
	// Submit-time failure message, shown inline right above the submit button. A bottom
	// toast can't be used here: the Flowbite modal is a native <dialog> in the browser's
	// top layer, which paints above any z-indexed toast overlay (#522). Local (not the
	// shared page-level `form` prop) so it's scoped to THIS modal's own submit.
	let submitError = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | undefined>(undefined);
	// Newly chosen images (a multi-file field). previews mirrors selectedFiles for display.
	let selectedFiles = $state<File[]>([]);
	let previews = $state<{ url: string; name: string }[]>([]);
	// Images already saved on the item (edit mode). Shown so the owner sees the full
	// set — not just the cover — but display-only: picking new files replaces the whole
	// set (see imageReplaceHint), so these are not individually removable.
	let existingImageUrls = $state<string[]>([]);

	function clearPreviews() {
		// Guard against a no-op write: this runs inside an $effect that reads `previews`,
		// so assigning a fresh [] unconditionally would retrigger the effect forever.
		if (previews.length === 0) return;
		for (const p of previews) URL.revokeObjectURL(p.url);
		previews = [];
		selectedFiles = [];
	}

	$effect(() => {
		if (isVisible) {
			selectedCategories = [...(editingItem?.categories ?? [])];
			selectedGroups = [...(editingItem?.groups ?? [])];
			trusteesOn = editingItem?.trusteesOnly ?? true;
			isDirty = false;
			imageError = null;
			// Seed the existing-image gallery so editing an item with several photos shows
			// them all. Needs pbUrl to build the file URLs; empty for add / external-only items.
			existingImageUrls =
				pbUrl && editingItem?.image?.length ? itemOwnFileUrls(pbUrl, editingItem) : [];
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

	// Keep in sync with the `items.image` file field's maxSelect in the backend
	// migration (1783500000_items_image_multi.js). Exceeding it makes PocketBase reject
	// the create/update, so cap here to avoid a silent failure.
	const MAX_IMAGES = 5;

	// Add images from the file picker or a drop, deduped by name+size, capped at MAX_IMAGES.
	function addFiles(files: File[]) {
		const imgs = files.filter((f) => f.type.startsWith('image/'));
		if (imgs.length === 0) return;
		const existing = new Set(selectedFiles.map((f) => `${f.name}_${f.size}`));
		let fresh = imgs.filter((f) => !existing.has(`${f.name}_${f.size}`));
		const room = MAX_IMAGES - selectedFiles.length;
		const truncated = fresh.length > room;
		if (truncated) fresh = fresh.slice(0, Math.max(0, room));
		if (fresh.length === 0) {
			if (truncated) imageError = texts.pages.items.imageMaxReached(MAX_IMAGES);
			return;
		}
		selectedFiles = [...selectedFiles, ...fresh];
		previews = [
			...previews,
			...fresh.map((f) => ({ url: URL.createObjectURL(f), name: f.name })),
		];
		imageError = truncated ? texts.pages.items.imageMaxReached(MAX_IMAGES) : null;
		isDirty = true;
	}

	function removeFileAt(i: number) {
		URL.revokeObjectURL(previews[i].url);
		previews = previews.filter((_, idx) => idx !== i);
		selectedFiles = selectedFiles.filter((_, idx) => idx !== i);
		isDirty = true;
	}

	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		addFiles(Array.from(input.files ?? []));
		// Reset so the same file can be re-added after removal.
		input.value = '';
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		addFiles(Array.from(event.dataTransfer?.files ?? []));
	}

	function openPicker() {
		fileInput?.click();
	}

	onDestroy(clearPreviews);

	$effect(() => {
		if (!isVisible) {
			form = null;
			imageError = null;
			submitError = null;
			clearPreviews();
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
					cancel();
					return;
				}
			}
			return async ({ result, update }) => {
				if (result.type === 'success') {
					isDirty = false;
					isVisible = false;
				} else if (result.type === 'failure') {
					// Show the failure inline right above the submit button (#522). Sourced
					// from this form's own result — not the shared page-level `form` prop,
					// which is fanned out to every row's modal and written by unrelated
					// inline/bulk actions — so it stays tied to *this* submit.
					submitError = (result.data as { message?: string } | undefined)?.message ?? null;
				}
				await update();
			};
		}}
	>
		<!-- LEFT COLUMN: image preview(s) + upload (drag & drop / click) -->
		<div class="flex flex-col gap-3 md:w-2/5">
			{#if previews.length > 0}
				<div class="grid grid-cols-2 gap-2">
					{#each previews as p, i (p.url)}
						<div class="relative">
							<img src={p.url} alt={p.name} class="h-24 w-full rounded-md object-cover" />
							<button
								type="button"
								onclick={() => removeFileAt(i)}
								aria-label={texts.pages.items.imageRemove}
								class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
							>
								<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					{/each}
				</div>
			{:else if existingImageUrls.length > 0}
				<!-- Existing images (edit mode), display-only: new uploads replace the whole set. -->
				<div class="grid grid-cols-2 gap-2">
					{#each existingImageUrls as url (url)}
						<img
							src={url}
							alt={editingItem?.name ?? ''}
							class="h-24 w-full rounded-md object-cover"
						/>
					{/each}
				</div>
			{:else}
				<Img
					src={imgUrl || placeholderimg}
					class="mx-auto h-40 w-40 rounded-md object-cover"
				/>
			{/if}

			<button
				type="button"
				aria-label={texts.pages.items.imageUploadAria}
				class="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-tinte-300 bg-transparent p-4 text-sm text-tinte-500 hover:border-primary-400 focus:ring-2 focus:ring-primary-300 dark:border-tinte-600 dark:text-tinte-400"
				onclick={openPicker}
				ondragover={(e) => e.preventDefault()}
				ondrop={handleDrop}
			>
				{texts.pages.items.imageDropHintMulti}
			</button>
			<input
				bind:this={fileInput}
				type="file"
				id="itemImage"
				class="sr-only"
				accept="image/*"
				multiple
				onchange={handleFileChange}
			/>
			<Helper class="text-center">{texts.pages.items.imageFormatsHint}</Helper>
			{#if type === 'edit'}
				<p class="text-center text-xs text-tinte-500 dark:text-tinte-400">
					{texts.pages.items.imageReplaceHint}
				</p>
			{/if}
			{#if imageError}
				<p class="text-center text-sm text-danger">{imageError}</p>
			{/if}
		</div>

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
			<div class="flex items-center">
				<Label class="flex">
					<Toggle
						name="trusteesOnly"
						classes={{ span: 'bg-primary-300 peer-checked:bg-safety' }}
						bind:checked={trusteesOn}
						>{texts.groups.itemTrusteesLabel}</Toggle
					>
				</Label>
				<!-- Info button lives OUTSIDE the <Label> so clicking it doesn't toggle the switch. -->
				<button
					type="button"
					class="flex items-center text-sm font-light text-tinte-500 dark:text-tinte-400"
					onclick={() => (showTrustInfo = !showTrustInfo)}
				>
					<QuestionCircleSolid class="ml-1 h-full" />
					<span class="sr-only">{texts.ui.explainThis}</span>
				</button>
			</div>
			{#if showTrustInfo}
				<div class="space-y-1 rounded-lg border border-tinte-200 bg-sand p-3 text-sm text-tinte-500">
					<p class="font-semibold text-tinte-900">{texts.groups.trustInfoTitle}</p>
					<p>{texts.groups.trustInfoBody}</p>
					<a href={resolve('/social')} class="flex items-center font-medium text-accent hover:underline">
						{texts.groups.trustInfoAddLink}<ChevronRightOutline class="ms-1.5 h-4 w-4 text-accent" />
					</a>
				</div>
			{/if}

			<!-- GROUP SHARING (independent of the trustees toggle) -->
			<div class="space-y-2 rounded-lg border border-tinte-200 bg-sand p-3">
				<span class="text-sm font-medium text-tinte-900">{texts.groups.itemShareTitle}</span>
				{#if groups.length === 0}
					<p class="text-sm text-tinte-500">{texts.groups.noGroupsForItem}</p>
					<a href={resolve('/user/groups')} class="flex items-center text-sm font-medium text-accent hover:underline">
						{texts.groups.goToGroups}<ChevronRightOutline class="ms-1.5 h-4 w-4 text-accent" />
					</a>
				{:else}
					<p class="text-xs text-tinte-500">{texts.groups.itemShareHint}</p>
					<div class="flex flex-col gap-1.5">
						{#each groups as g (g.id)}
							<Label class="flex cursor-pointer items-center gap-2 font-normal">
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
			<Button class="min-button bg-primary-200 hover:bg-primary" type="submit">
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
					href={resolve(`/conversations/${form.conversationIds[0]}`)}
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
			<Button class="min-button bg-accent-200 hover:bg-danger" type="submit"
				>{texts.buttons.delete}</Button
			>
		</form>
	{/if}
</Modal>
