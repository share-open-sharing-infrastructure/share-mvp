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
		onlyAvailable: boolean;
		ownerType: string;
	}

	let { selectedCategories, op, q, perPage, onlyAvailable, ownerType }: Props = $props();

	function buildUrl(newCats: string[], newOp: 'or' | 'and'): string {
		const parts: string[] = [];
		if (q) parts.push(`q=${encodeURIComponent(q)}`);
		if (perPage !== 10) parts.push(`perPage=${perPage}`);
		if (newCats.length > 0) parts.push(`cats=${encodeURIComponent(newCats.join(','))}`);
		if (newOp === 'and') parts.push('op=and');
		if (!onlyAvailable) parts.push('onlyAvailable=false');
		if (ownerType !== 'all') parts.push(`ownerType=${ownerType}`);
		// always reset to page 1 when filter changes
		return resolve('/search') + (parts.length ? '?' + parts.join('&') : '');
	}

	function toggleCat(cat: string) {
		const next = selectedCategories.includes(cat) ? [] : [cat];
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
					: 'border-tinte-300 bg-papier text-tinte-700 hover:border-primary hover:text-primary dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-300 dark:hover:border-primary dark:hover:text-primary'}"
			>
				{cat}
			</button>
		{/each}
	</div>

	{#if selectedCategories.length >= 2}
		<div class="flex justify-center">
			<label class="flex items-center gap-2 cursor-pointer">
				<Toggle checked={andActive} onchange={toggleOp} />
				<span class="text-sm text-tinte-600 dark:text-tinte-400">
					{texts.pages.search.categoryFilterAnd}
				</span>
			</label>
		</div>
	{/if}
</div>
