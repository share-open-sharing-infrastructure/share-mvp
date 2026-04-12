<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Toggle } from 'flowbite-svelte';
	import { ITEM_CATEGORIES } from '$lib/texts';
	import { texts } from '$lib/texts';

	interface Props {
		selectedCategories: string[];
		op: 'or' | 'and';
		q: string;
		perPage: number;
	}

	let { selectedCategories, op, q, perPage }: Props = $props();

	function buildUrl(newCats: string[], newOp: 'or' | 'and'): string {
		const params = new URLSearchParams();
		if (q) params.set('q', q);
		if (perPage !== 10) params.set('perPage', String(perPage));
		if (newCats.length > 0) params.set('cats', newCats.join(','));
		if (newOp === 'and') params.set('op', 'and');
		// always reset to page 1 when filter changes
		return resolve('/search') + '?' + params.toString();
	}

	function toggleCat(cat: string) {
		const next = selectedCategories.includes(cat)
			? selectedCategories.filter((c) => c !== cat)
			: [...selectedCategories, cat];
		goto(buildUrl(next, op));
	}

	function toggleOp() {
		goto(buildUrl(selectedCategories, op === 'or' ? 'and' : 'or'));
	}

	let andActive = $derived(op === 'and');
</script>

<div class="mt-3 space-y-2">
	<div class="flex flex-wrap justify-center gap-2">
		{#each ITEM_CATEGORIES as cat(cat)}
			{@const active = selectedCategories.includes(cat)}
			<button
				type="button"
				onclick={() => toggleCat(cat)}
				class="rounded-full border px-3 py-1 text-sm font-medium transition-colors cursor-pointer
					{active
					? 'bg-primary border-primary text-white'
					: 'border-gray-300 bg-white text-gray-700 hover:border-primary hover:text-primary dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-primary dark:hover:text-primary'}"
			>
				{cat}
			</button>
		{/each}
	</div>

	{#if selectedCategories.length >= 2}
		<div class="flex justify-center">
			<label class="flex items-center gap-2 cursor-pointer">
				<Toggle checked={andActive} onchange={toggleOp} />
				<span class="text-sm text-gray-600 dark:text-gray-400">
					{texts.pages.search.categoryFilterAnd}
				</span>
			</label>
		</div>
	{/if}
</div>
