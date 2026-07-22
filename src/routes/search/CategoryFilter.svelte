<script lang="ts">
	import { Toggle } from 'flowbite-svelte';
	import { ITEM_CATEGORIES } from '$lib/categories';
	import { texts } from '$lib/texts';

	// Rendered inside FilterModal (issue #505): holds no navigation of its own. Selections
	// are local draft state, bound up to the modal, and only committed to the URL when
	// "Filter anwenden" is clicked there.
	interface Props {
		selectedCategories: string[];
		op: 'or' | 'and';
	}

	let { selectedCategories = $bindable(), op = $bindable() }: Props = $props();

	function toggleCat(cat: string) {
		selectedCategories = selectedCategories.includes(cat) ? [] : [cat];
	}

	function toggleOp() {
		op = op === 'or' ? 'and' : 'or';
	}

	let andActive = $derived(op === 'and');
</script>

<div class="mt-3 space-y-2">
	<div class="flex flex-wrap gap-2">
		{#each ITEM_CATEGORIES as cat(cat)}
			{@const active = selectedCategories.includes(cat)}
			<button
				type="button"
				aria-pressed={active}
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
