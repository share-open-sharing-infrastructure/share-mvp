<script lang="ts">
	import { goto } from '$app/navigation';
	import { ITEM_CATEGORIES } from '$lib/texts';
	import { buildSearchUrl } from './searchUrl';

	interface Props {
		selectedCategories: string[];
		q: string;
		perPage: number;
		onlyAvailable: boolean;
		ownerType: string;
	}

	let { selectedCategories, q, perPage, onlyAvailable, ownerType }: Props = $props();

	function buildUrl(newCats: string[]): string {
		// Always reset to page 1 when filter changes (omit page param).
		return buildSearchUrl({ q, cats: newCats, onlyAvailable, ownerType, perPage: perPage !== 10 ? perPage : undefined });
	}

	function toggleCat(cat: string) {
		// Multiple categories are combined with OR (matches any selected category).
		const next = selectedCategories.includes(cat)
			? selectedCategories.filter((c) => c !== cat)
			: [...selectedCategories, cat];
		goto(buildUrl(next));
	}
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
</div>
