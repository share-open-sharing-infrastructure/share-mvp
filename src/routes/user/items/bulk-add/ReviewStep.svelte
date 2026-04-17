<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Checkbox, Input, Label, Spinner } from 'flowbite-svelte';
	import { texts, ITEM_CATEGORIES } from '$lib/texts';
	import { compressImage } from '$lib/utils/imageUtils';

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
		submitting: boolean;
		allAnalyzed: boolean;
		onBack: () => void;
	}

	let { drafts = $bindable(), submitting = $bindable(), allAnalyzed, onBack }: Props = $props();

	function removeDraft(i: number) {
		URL.revokeObjectURL(drafts[i].previewUrl);
		drafts = drafts.filter((_, idx) => idx !== i);
	}

	function toggleCategory(draftIndex: number, cat: string) {
		const current = drafts[draftIndex].categories;
		if (current.includes(cat)) {
			drafts[draftIndex] = { ...drafts[draftIndex], categories: current.filter((c) => c !== cat) };
		} else if (current.length < 3) {
			drafts[draftIndex] = { ...drafts[draftIndex], categories: [...current, cat] };
		}
	}

	function autoresize(node: HTMLTextAreaElement, value?: string) {
		void value; // parameter exists only to trigger update() when the bound value changes
		function resize() {
			node.style.height = 'auto';
			node.style.height = node.scrollHeight + 'px';
		}
		node.addEventListener('input', resize);
		setTimeout(resize, 0);
		return {
			update() { setTimeout(resize, 0); },
			destroy() { node.removeEventListener('input', resize); },
		};
	}
</script>

<p class="mb-4 text-sm text-tinte-500 dark:text-tinte-400">
	{texts.bulkUpload.reviewTitle}
</p>

{#if !allAnalyzed}
	<div class="mb-4 flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
		<Spinner size="4" />
		{texts.bulkUpload.analyzing}
	</div>
{/if}

<form
	method="POST"
	action="?/bulkCreate"
	enctype="multipart/form-data"
	use:enhance={async ({ formData, cancel }) => {
		if (submitting) { cancel(); return; }
		submitting = true;
		for (let i = 0; i < drafts.length; i++) {
			const compressed = await compressImage(drafts[i].file);
			formData.set(`image_${i}`, compressed, drafts[i].file.name);
			formData.set(`name_${i}`, drafts[i].name);
			formData.set(`description_${i}`, drafts[i].description);
			formData.set(`categories_${i}`, JSON.stringify(drafts[i].categories));
		}
		formData.set('count', String(drafts.length));
		return async ({ update }) => {
			submitting = false;
			await update();
		};
	}}
>
	<div class="flex flex-col gap-6">
		{#each drafts as draft, i (draft.previewUrl)}
			<div class="flex gap-4 rounded-xl border border-tinte-200 bg-sand p-4 shadow-sm dark:border-tinte-700 dark:bg-tinte-800">
				<img
					src={draft.previewUrl}
					alt="Vorschau"
					class="h-24 w-24 shrink-0 rounded-lg object-cover"
				/>

				<div class="flex flex-1 flex-col gap-3">
					{#if draft.status === 'analyzing'}
						<div class="flex items-center gap-2 text-sm text-tinte-500">
							<Spinner size="4" />
							{texts.bulkUpload.analyzing}
						</div>
					{:else}
						{#if draft.status === 'error'}
							<p class="text-xs text-accent-500">{texts.bulkUpload.analysisError}</p>
						{/if}

						<Label class="space-y-1">
							<span class="text-xs font-medium">Name</span>
							<Input
								type="text"
								size="sm"
								placeholder={texts.forms.itemName}
								bind:value={draft.name}
							/>
						</Label>

						<Label class="w-full space-y-1">
							<span class="text-xs font-medium">{texts.forms.description}</span>
							<textarea
								use:autoresize={draft.description}
								rows={1}
								placeholder={texts.forms.itemDescription}
								bind:value={draft.description}
								class="block w-full resize-none overflow-hidden rounded-lg border border-tinte-300 bg-papier p-2.5 text-sm text-tinte-900 focus:border-primary-500 focus:ring-primary-500 dark:border-tinte-600 dark:bg-tinte-700 dark:text-white dark:placeholder-tinte-400 dark:focus:border-primary-500 dark:focus:ring-primary-500"
							></textarea>
						</Label>

						<div class="space-y-1">
							<span class="text-xs font-medium">{texts.forms.itemCategories}</span>
							<div class="flex flex-wrap gap-x-3 gap-y-1.5">
								{#each ITEM_CATEGORIES as cat (cat)}
									<Label class="flex cursor-pointer items-center gap-1 font-normal text-xs">
										<Checkbox
											checked={draft.categories.includes(cat)}
											disabled={draft.categories.length >= 3 && !draft.categories.includes(cat)}
											onchange={() => toggleCategory(i, cat)}
										/>
										{cat}
									</Label>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<button
					type="button"
					onclick={() => removeDraft(i)}
					class="self-start text-tinte-400 hover:text-accent-500"
					aria-label={texts.bulkUpload.removeItem}
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		{/each}
	</div>

	<div class="mt-6 flex justify-end gap-3">
		<Button type="button" color="alternative" onclick={onBack}>Zurück</Button>
		<Button
			type="submit"
			class="bg-primary"
			disabled={submitting || drafts.length === 0 || !allAnalyzed}
		>
			{#if submitting}
				<Spinner size="4" class="mr-2" />
				{texts.bulkUpload.creating}
			{:else}
				{texts.bulkUpload.createAll(drafts.length)}
			{/if}
		</Button>
	</div>
</form>
