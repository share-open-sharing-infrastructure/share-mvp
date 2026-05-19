<script lang="ts">
	import { Button, Modal } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';

	let { open, conversationId }: { open: boolean; conversationId: string } = $props();

	let selectedAnswer = $state('');

	// Shuffle substantive options on each mount; keep tail options anchored at the end
	const TAIL_KEYS = new Set(['unsure', 'other']);
	const allEntries = Object.entries(texts.counterfactual.options) as [string, string][];
	const head = allEntries.filter(([k]) => !TAIL_KEYS.has(k));
	const tail = allEntries.filter(([k]) => TAIL_KEYS.has(k));
	for (let i = head.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[head[i], head[j]] = [head[j], head[i]];
	}
	const orderedOptions = [...head, ...tail];
</script>

<Modal title={texts.counterfactual.title} {open} dismissable={false}>
	<p class="mb-4 font-bold text-tinte-700 dark:text-tinte-300">{texts.counterfactual.question}</p>
	<p class="mb-4 text-sm text-tinte-500 dark:text-tinte-400 italic">{texts.counterfactual.explainer}</p>

	<!-- Separate skip form so its submit button never competes with the radio value -->
	<form id="cf-skip" method="POST" action="?/submitCounterfactual" use:enhance>
		<input type="hidden" name="conversationId" value={conversationId} />
		<input type="hidden" name="answer" value="skipped" />
	</form>

	<form method="POST" action="?/submitCounterfactual" use:enhance>
		<input type="hidden" name="conversationId" value={conversationId} />
		<div class="flex flex-col gap-3 mb-6">
			{#each orderedOptions as [value, label] (value)}
				<label class="flex items-center gap-2 cursor-pointer">
					<input type="radio" name="answer" {value} required class="accent-primary"
						onchange={() => selectedAnswer = value} />
					<span>{label}</span>
				</label>
			{/each}
			{#if selectedAnswer === 'other'}
				<textarea
					name="answerText"
					required
					rows="2"
					placeholder={texts.counterfactual.otherPlaceholder}
					class="w-full rounded-lg border border-tinte-300 dark:border-tinte-600 bg-white dark:bg-tinte-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
				></textarea>
			{/if}
		</div>
		<div class="flex justify-between items-center">
			<button type="submit" form="cf-skip" class="text-sm text-tinte-400 underline hover:text-tinte-600">
				{texts.counterfactual.skip}
			</button>
			<Button class="min-button bg-primary-200 hover:bg-primary hover:cursor-pointer" type="submit">{texts.counterfactual.submit}</Button>
		</div>
	</form>
</Modal>
