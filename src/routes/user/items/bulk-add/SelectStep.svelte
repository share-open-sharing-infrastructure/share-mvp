<script lang="ts">
	import { Accordion, AccordionItem, Button } from 'flowbite-svelte';
	import { texts } from '$lib/texts';

	type DraftStatus = 'pending' | 'analyzing' | 'done' | 'error';

	type ItemDraft = {
		file: File;
		previewUrl: string;
		name: string;
		description: string;
		categories: string[];
		status: DraftStatus;
	};

	interface Props {
		drafts: ItemDraft[];
		noPhotosError: boolean;
		onContinue: () => void;
	}

	let { drafts = $bindable(), noPhotosError = $bindable(), onContinue }: Props = $props();

	let fileInput = $state<HTMLInputElement | undefined>(undefined);

	function addFiles(files: File[]) {
		const existing = new Set(drafts.map((d) => `${d.file.name}_${d.file.size}`));
		const newDrafts = files
			.filter((f) => !existing.has(`${f.name}_${f.size}`))
			.map((file) => ({
				file,
				previewUrl: URL.createObjectURL(file),
				name: '',
				description: '',
				categories: [],
				status: 'pending' as DraftStatus,
			}));
		drafts = [...drafts, ...newDrafts];
		noPhotosError = false;
	}

	function onFilesSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		addFiles(Array.from(input.files ?? []));
		// Reset so the same file can be re-added after removal
		input.value = '';
	}

	function removeDraft(i: number) {
		URL.revokeObjectURL(drafts[i].previewUrl);
		drafts = drafts.filter((_, idx) => idx !== i);
	}
</script>

<Accordion flush class="mb-4">
	<AccordionItem>
		{#snippet header()}{texts.bulkUpload.howItWorksHeader}{/snippet}
		<p class="text-sm text-gray-600 dark:text-gray-400">
			{texts.bulkUpload.howItWorksBody}
		</p>
	</AccordionItem>
</Accordion>

<!-- DROP ZONE / FILE PICKER -->
<div
	role="region"
	aria-label="Foto-Upload-Bereich"
	class="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-10 dark:border-gray-600 dark:bg-gray-800"
	ondragover={(e) => e.preventDefault()}
	ondrop={(e) => {
		e.preventDefault();
		const files = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
			f.type.startsWith('image/')
		);
		if (files.length) addFiles(files);
	}}
>
	<!-- Dropzone border -->
	<svg
		class="h-12 w-12 text-gray-400"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
		aria-hidden="true"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="1.5"
			d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
		/>
	</svg>

	<p class="max-w-sm rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
		{texts.bulkUpload.disclaimer}
	</p>

	<p class="hidden [@media(hover:none)_and_(pointer:coarse)]:block max-w-sm rounded-lg bg-blue-50 px-3 py-2 text-center text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
		{texts.bulkUpload.mobileTip}
	</p>

	<p class="text-sm text-gray-500 dark:text-gray-400">{texts.bulkUpload.dropzoneLabel}</p>

	<label
		class="cursor-pointer rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:ring-4 focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700"
	>
		{texts.bulkUpload.selectFiles}
		<input
			bind:this={fileInput}
			type="file"
			multiple
			accept="image/*"
			class="sr-only"
			onchange={onFilesSelected}
		/>
	</label>

	{#if drafts.length > 0}
		<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
			{texts.bulkUpload.filesSelected(drafts.length)}
		</p>
		<div class="flex flex-wrap justify-center gap-2">
			{#each drafts as draft, i (draft.previewUrl)}
				<div class="relative">
					<img
						src={draft.previewUrl}
						alt="Vorschau"
						class="h-16 w-16 rounded-md object-cover ring-1 ring-gray-200"
					/>
					<button
						type="button"
						onclick={() => removeDraft(i)}
						aria-label={texts.bulkUpload.removeItem}
						class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
					>
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}

	{#if noPhotosError}
		<p class="text-sm text-red-600">{texts.bulkUpload.noPhotosSelected}</p>
	{/if}
</div>

<div class="mt-6 flex justify-end gap-3">
	<Button href="/user/items" color="alternative">Zurück</Button>
	<Button onclick={onContinue} class="bg-primary" disabled={drafts.length === 0}>
		{texts.bulkUpload.continue}
	</Button>
</div>
