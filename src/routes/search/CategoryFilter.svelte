<script lang="ts">
	import { ITEM_CATEGORIES } from '$lib/categories';

	// Rendered inside FilterModal (issue #505): holds no navigation of its own. Selections
	// are local draft state, bound up to the modal, and only committed to the URL when
	// "Filter anwenden" is clicked there.
	interface Props {
		selectedCategories: string[];
	}

	let { selectedCategories = $bindable() }: Props = $props();

	function toggleCat(cat: string) {
		// Multiple categories combine with OR (an item matches any selected category),
		// so toggling adds/removes from the selection instead of replacing it.
		selectedCategories = selectedCategories.includes(cat)
			? selectedCategories.filter((c) => c !== cat)
			: [...selectedCategories, cat];
	}
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
</div>
