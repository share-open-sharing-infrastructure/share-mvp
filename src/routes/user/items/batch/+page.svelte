<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import { Button, Input, Label, Textarea, Toggle, Spinner, Helper } from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import placeholderimg from '$lib/images/placeholder_img.png';
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';

	// --- Types ---

	type BatchStep = 'upload' | 'analyzing' | 'review';
	type AnalysisStatus = 'pending' | 'done' | 'error';

	interface DraftItem {
		file: File;
		previewUrl: string;
		name: string;
		description: string;
		trusteesOnly: boolean;
		status: AnalysisStatus;
		errorMessage?: string;
	}

	// --- State ---

	let step: BatchStep = $state('upload');
	let selectedFiles: File[] = $state([]);
	let previewUrls: string[] = $state([]);
	let place: string = $state('');
	let draftItems: DraftItem[] = $state([]);
	let isSaving: boolean = $state(false);
	let saveError: string = $state('');

	// --- File selection ---

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);

		// Revoke previous object URLs to avoid memory leaks
		previewUrls.forEach((url) => URL.revokeObjectURL(url));

		selectedFiles = files;
		previewUrls = files.map((f) => URL.createObjectURL(f));
	}

	onDestroy(() => {
		previewUrls.forEach((url) => URL.revokeObjectURL(url));
	});

	// --- Step 1 → 2 ---

	async function startAnalysis() {
		draftItems = selectedFiles.map((file, i) => ({
			file,
			previewUrl: previewUrls[i],
			name: '',
			description: '',
			trusteesOnly: false,
			status: 'pending' as AnalysisStatus,
		}));
		step = 'analyzing';
		await analyzeAll();
	}

	function resizeAndEncode(file: File, maxPx = 800): Promise<string> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const url = URL.createObjectURL(file);
			img.onload = () => {
				URL.revokeObjectURL(url);
				const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
				const canvas = document.createElement('canvas');
				canvas.width = Math.round(img.width * scale);
				canvas.height = Math.round(img.height * scale);
				canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
				resolve(canvas.toDataURL('image/jpeg', 0.85));
			};
			img.onerror = reject;
			img.src = url;
		});
	}

	async function analyzeAll() {
		await Promise.all(
			draftItems.map(async (item, index) => {
				try {
					const imageBase64 = await resizeAndEncode(item.file);
					const res = await fetch('/api/analyze-image', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg' }),
					});
					const data = await res.json();

					if (data.success) {
						draftItems[index].name = data.name;
						draftItems[index].description = data.description;
						draftItems[index].status = 'done';
					} else {
						draftItems[index].status = 'error';
						draftItems[index].errorMessage = data.error ?? texts.batch.analysisError;
					}
				} catch {
					draftItems[index].status = 'error';
					draftItems[index].errorMessage = texts.batch.networkError;
				}
			})
		);

		step = 'review';
	}

	// --- Computed ---

	let analyzedCount = $derived(draftItems.filter((i) => i.status !== 'pending').length);
	let canSave = $derived(isSaving === false && draftItems.length > 0 && draftItems.every((i) => i.name.trim() !== ''));

	// --- Step 3: save ---

	function removeItem(index: number) {
		const item = draftItems[index];
		URL.revokeObjectURL(item.previewUrl);
		draftItems = draftItems.filter((_, i) => i !== index);
	}

	async function saveBatch() {
		isSaving = true;
		saveError = '';

		for (const item of draftItems) {
			if (!item.name.trim()) continue;

			const fd = new FormData();
			fd.append('itemName', item.name.trim());
			fd.append('itemDescription', item.description.trim());
			fd.append('itemPlace', place.trim());
			fd.append('itemImage', item.file, item.file.name);
			if (item.trusteesOnly) fd.append('trusteesOnly', 'on');

			try {
				const res = await fetch('/user/items/batch?/batchCreate', {
					method: 'POST',
					body: fd,
					redirect: 'manual',
				});

				// Session expired — auth hook issued a 307 redirect to /auth/login
				if (res.type === 'opaqueredirect' || res.status === 0) {
					await goto(resolve('/auth/login'));
					return;
				}

				if (!res.ok) {
					const data = await res.json().catch(() => ({}));
					saveError = data?.data?.message ?? `${texts.batch.saveError} "${item.name}"`;
					isSaving = false;
					return;
				}
			} catch {
				saveError = texts.batch.saveNetworkError;
				isSaving = false;
				return;
			}
		}

		await goto(resolve('/user/items'));
	}
</script>

<section class="bg-white dark:bg-gray-900 min-h-screen">
	<div class="max-w-3xl mx-auto px-4 pt-6 pb-16">
		<h1 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-20 mb-2">
			{texts.batch.pageTitle}
		</h1>

		<!-- Step indicator -->
		<p class="text-sm text-gray-500 dark:text-gray-400 mb-8">
			{#if step === 'upload'}
				{texts.batch.stepUpload}
			{:else if step === 'analyzing'}
				{texts.batch.stepAnalyzing}
			{:else}
				{texts.batch.stepReview}
			{/if}
		</p>

		<!-- ───────────────────────── STEP 1: UPLOAD ───────────────────────── -->
		{#if step === 'upload'}
			<div class="flex flex-col gap-6">
				<Label class="space-y-2">
					<span>{texts.batch.placeLabel}</span>
					<Input
						type="text"
						placeholder={texts.batch.placePlaceholder}
						bind:value={place}
						autocomplete="off"
					/>
					<Helper>{texts.batch.placeHelper}</Helper>
				</Label>

				<Label class="space-y-2">
					<span>{texts.batch.selectPhotos}</span>
					<input
						type="file"
						multiple
						accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
						class="mb-2 min-button bg-primary"
						onchange={handleFileSelect}
					/>
					<Helper>{texts.batch.photoHelper}</Helper>
				</Label>

				<!-- Thumbnail grid -->
				{#if previewUrls.length > 0}
					<div class="flex flex-wrap gap-3">
						{#each previewUrls as url, i (i)}
							<img
								src={url}
								alt={selectedFiles[i]?.name ?? 'Vorschau'}
								class="h-24 w-24 rounded-md object-cover border border-gray-200 dark:border-gray-700"
							/>
						{/each}
					</div>
					<p class="text-sm text-gray-500">{selectedFiles.length} {texts.batch.photosSelected}</p>
				{/if}

				<Button
					class="min-button bg-primary"
					disabled={selectedFiles.length === 0 || place.trim() === ''}
					onclick={startAnalysis}
				>
					{texts.batch.analyzeButton}
				</Button>
			</div>

		<!-- ───────────────────────── STEP 2: ANALYZING ───────────────────────── -->
		{:else if step === 'analyzing'}
			<div class="flex flex-col items-center gap-6 py-16">
				<Spinner size="12" />
				<p class="text-gray-600 dark:text-gray-300 text-center">
					{texts.batch.analyzingProgress(analyzedCount, draftItems.length)}
				</p>
				<div class="flex flex-wrap gap-3 justify-center">
					{#each draftItems as item (item.previewUrl)}
						<div class="relative">
							<img
								src={item.previewUrl}
								alt={item.file.name}
								class="h-20 w-20 rounded-md object-cover border border-gray-200 dark:border-gray-700"
							/>
							<span class="absolute -top-1 -right-1 text-base leading-none">
								{#if item.status === 'pending'}⏳
								{:else if item.status === 'done'}✅
								{:else}❌
								{/if}
							</span>
						</div>
					{/each}
				</div>
			</div>

		<!-- ───────────────────────── STEP 3: REVIEW ───────────────────────── -->
		{:else if step === 'review'}
			<div class="flex flex-col gap-6">
				<!-- Shared place field -->
				<div class="flex items-center gap-3">
					<Label class="flex-1 space-y-1">
						<span class="text-sm font-medium">{texts.batch.placeLabel}</span>
						<Input type="text" bind:value={place} autocomplete="off" />
					</Label>
				</div>

				{#if saveError}
					<CustomAlert type="error" message={saveError} />
				{/if}

				<!-- Item cards -->
				{#each draftItems as item, i (i)}
					<div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-4">
						<div class="flex gap-4 items-start">
							<img
								src={item.previewUrl ?? placeholderimg}
								alt={item.file.name}
								class="h-28 w-28 rounded-md object-cover border border-gray-200 dark:border-gray-700 shrink-0"
							/>
							<div class="flex-1 flex flex-col gap-3">
								{#if item.status === 'error'}
									<CustomAlert type="warn" message={item.errorMessage ?? texts.batch.analysisError} />
								{/if}

								<Label class="space-y-1">
									<span class="text-sm">Name:</span>
									<Input
										type="text"
										placeholder={texts.forms.itemName}
										bind:value={draftItems[i].name}
										autocomplete="off"
									/>
								</Label>

								<Label class="space-y-1">
									<span class="text-sm">{texts.forms.description}</span>
									<Textarea
										placeholder={texts.forms.itemDescription}
										bind:value={draftItems[i].description}
										rows={3}
										autocomplete="off"
									/>
								</Label>

								<Toggle bind:checked={draftItems[i].trusteesOnly}>
									{texts.ui.trustedOnly}
								</Toggle>
							</div>
						</div>

						<!-- Remove button -->
						<div class="flex justify-end">
							<Button
								size="xs"
								color="red"
								class="min-button"
								onclick={() => removeItem(i)}
							>
								<TrashBinOutline class="mr-1 h-4 w-4" />
								{texts.batch.removeItem}
							</Button>
						</div>
					</div>
				{/each}

				{#if draftItems.length === 0}
					<p class="text-center text-gray-500 py-8">{texts.batch.noItemsLeft}</p>
				{/if}

				<div class="flex gap-3 justify-end">
					<Button
						class="min-button bg-primary-50"
						onclick={() => { step = 'upload'; }}
					>
						{texts.batch.backButton}
					</Button>
					<Button
						class="min-button bg-primary"
						disabled={!canSave}
						onclick={saveBatch}
					>
						{#if isSaving}
							<Spinner size="4" class="mr-2" />
						{/if}
						{texts.batch.saveAllButton}
					</Button>
				</div>
			</div>
		{/if}
	</div>
</section>
