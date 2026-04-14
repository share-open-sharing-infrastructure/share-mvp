<script lang="ts">
	import { texts } from '$lib/texts';
	import { compressImage } from '$lib/utils/imageUtils';
	import SelectStep from './SelectStep.svelte';
	import ReviewStep from './ReviewStep.svelte';

	type DraftStatus = 'pending' | 'analyzing' | 'done' | 'error';

	type ItemDraft = {
		file: File;
		previewUrl: string;
		name: string;
		description: string;
		categories: string[];
		status: DraftStatus;
	};

	let drafts = $state<ItemDraft[]>([]);
	let phase = $state<'select' | 'review'>('select');
	let submitting = $state(false);
	let noPhotosError = $state(false);

	let allAnalyzed = $derived(drafts.every((draft) => draft.status === 'done' || draft.status === 'error'));

	// 800px keeps token count low enough to stay within Mistral's per-request limit
	const ANALYZE_MAX_DIM = 1000;
	// Mistral allows 2 req/s; 1100ms gives a small safety margin
	const ANALYZE_INTERVAL_MS = 500;

	async function analyzeAll() {
		if (drafts.length === 0) {
			noPhotosError = true;
			return;
		}
		phase = 'review';
		drafts = drafts.map((d) => ({ ...d, status: 'analyzing' }));

		for (let i = 0; i < drafts.length; i++) {
			if (i > 0) await new Promise((r) => setTimeout(r, ANALYZE_INTERVAL_MS));
			try {
				const compressed = await compressImage(drafts[i].file, ANALYZE_MAX_DIM, 0.8);
				const base64 = await blobToBase64(compressed);
				const res = await fetch('/api/analyze-item', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
				});
				if (!res.ok) throw new Error('Analysis failed');
				const data = await res.json();
				drafts[i] = {
					...drafts[i],
					name: data.name ?? '',
					description: data.description ?? '',
					categories: data.categories ?? [],
					status: 'done',
				};
			} catch {
				drafts[i] = { ...drafts[i], name: '', description: '', categories: [], status: 'error' };
			}
		}
	}

	async function blobToBase64(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve((reader.result as string).split(',')[1]);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}
</script>

<div class="mx-auto max-w-2xl px-4 py-8">
	<h2 class="mb-6 text-center text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
		{texts.bulkUpload.pageTitle}
	</h2>

	{#if phase === 'select'}
		<SelectStep bind:drafts bind:noPhotosError onContinue={analyzeAll} />
	{:else}
		<ReviewStep bind:drafts bind:submitting {allAnalyzed} onBack={() => (phase = 'select')} />
	{/if}
</div>
