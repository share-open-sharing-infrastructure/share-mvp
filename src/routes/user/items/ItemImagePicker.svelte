<script lang="ts">
	import { Helper, Img } from 'flowbite-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { onDestroy } from 'svelte';
	import { texts } from '$lib/texts';
	import placeholderimg from '$lib/images/placeholder_img.png';

	/**
	 * Multi-image picker column of the item add/edit modal: drag & drop / click-to-pick,
	 * preview grid with per-image removal, and the display-only gallery of already-saved
	 * images in edit mode. Owns all file/preview state; the parent binds `selectedFiles`
	 * (it compresses + appends them at submit time) and passes `visible` so previews are
	 * cleared when the surrounding modal closes.
	 */
	interface Props {
		/** Newly chosen images — bound by the parent for submit-time compression. */
		selectedFiles: File[];
		/** Images already saved on the item (edit mode). Display-only: picking new files
		 *  replaces the whole set (see imageReplaceHint), so these are not removable. */
		existingImageUrls?: string[];
		/** Existing cover image URL, shown in edit mode until new files are chosen. */
		imgUrl?: string;
		mode: 'add' | 'edit';
		/** Alt text for the existing-image gallery (the item's name). */
		itemName?: string;
		/** The surrounding modal's open state — previews are cleared when it closes. */
		visible: boolean;
		/** Called whenever the user changes the selection (drives the parent's dirty flag). */
		onDirty?: () => void;
	}

	let {
		selectedFiles = $bindable(),
		existingImageUrls = [],
		imgUrl,
		mode,
		itemName = '',
		visible,
		onDirty,
	}: Props = $props();

	let imageError = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | undefined>(undefined);
	// previews mirrors selectedFiles for display.
	let previews = $state<{ url: string; name: string }[]>([]);

	// Keep in sync with the `items.image` file field's maxSelect in the backend
	// migration (1783500000_items_image_multi.js). Exceeding it makes PocketBase reject
	// the create/update, so cap here to avoid a silent failure.
	const MAX_IMAGES = 5;

	function clearPreviews() {
		// Guard against a no-op write: this runs inside an $effect that reads `previews`,
		// so assigning a fresh [] unconditionally would retrigger the effect forever.
		if (previews.length === 0) return;
		for (const p of previews) URL.revokeObjectURL(p.url);
		previews = [];
		selectedFiles = [];
	}

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
		onDirty?.();
	}

	function removeFileAt(i: number) {
		URL.revokeObjectURL(previews[i].url);
		previews = previews.filter((_, idx) => idx !== i);
		selectedFiles = selectedFiles.filter((_, idx) => idx !== i);
		onDirty?.();
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
		if (!visible) {
			imageError = null;
			clearPreviews();
		}
	});
</script>

<div class="flex flex-col gap-3 md:w-2/5">
	{#if previews.length > 0}
		<div class="grid grid-cols-2 gap-2">
			{#each previews as p, i (p.url)}
				<div class="relative">
					<img src={p.url} alt={p.name} class="h-24 w-full rounded-md object-cover" />
					<Button
						variant="danger"
						size="icon-sm"
						onclick={() => removeFileAt(i)}
						aria-label={texts.pages.items.imageRemove}
						class="absolute -right-2 -top-2"
					>
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</Button>
				</div>
			{/each}
		</div>
	{:else if existingImageUrls.length > 0}
		<!-- Existing images (edit mode), display-only: new uploads replace the whole set. -->
		<div class="grid grid-cols-2 gap-2">
			{#each existingImageUrls as url (url)}
				<img
					src={url}
					alt={itemName}
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
	{#if mode === 'edit'}
		<p class="text-center text-xs text-tinte-500 dark:text-tinte-400">
			{texts.pages.items.imageReplaceHint}
		</p>
	{/if}
	{#if imageError}
		<p class="text-center text-sm text-danger">{imageError}</p>
	{/if}
</div>
