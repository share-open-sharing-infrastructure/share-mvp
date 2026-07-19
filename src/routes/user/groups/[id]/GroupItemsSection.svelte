<script lang="ts">
	import { texts } from '$lib/texts';
	import { itemImageUrl } from '$lib/utils/utils';
	import { matchesItemSearch, isAvailable } from '$lib/utils/itemSearch';
	import type { ItemPublic } from '$lib/types/models';
	import ItemCard from '../../../search/ItemCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	interface Props {
		items: ItemPublic[];
		pbImgUrl: string;
	}

	const { items, pbImgUrl }: Props = $props();

	let searchText = $state('');
	let selectedCategory = $state<string | null>(null);
	let onlyAvailable = $state(false);

	// Availability filter, matching /search: keep everything except explicitly unavailable
	// items (so `available` and `unknown` both pass). Composes with search + category below.
	const availabilityFiltered = $derived(onlyAvailable ? items.filter(isAvailable) : items);

	// Free-text filter over the already-loaded items (in-memory, no extra request). `items`
	// arrives newest-first (server sorts `-created`); filtering preserves that order.
	const normalizedSearch = $derived(searchText.trim().toLowerCase());
	const textFilteredItems = $derived(
		availabilityFiltered.filter((i) => matchesItemSearch(i, normalizedSearch))
	);

	// Category chips + counts are derived from the text-filtered set, so the numbers always
	// reflect the active search.
	const categories = $derived([...new Set(items.flatMap((i) => i.categories ?? []))].sort());

	const categoryCounts = $derived(
		Object.fromEntries(
			categories.map((cat) => [cat, textFilteredItems.filter((i) => (i.categories ?? []).includes(cat)).length])
		)
	);

	const displayedItems = $derived(
		selectedCategory === null
			? textFilteredItems
			: textFilteredItems.filter((i) => (i.categories ?? []).includes(selectedCategory!))
	);

	// Render in client-side pages so a large group doesn't flood the DOM; the search and
	// category filter above still act on the full set instantly. `visibleCount` is reset to
	// one page whenever the filter changes (see the search/category handlers below).
	const PAGE_SIZE = 12;
	let visibleCount = $state(PAGE_SIZE);
	const pagedItems = $derived(displayedItems.slice(0, visibleCount));
</script>

<section class="bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-6 sm:p-8 space-y-4">
	<h2 class="text-lg font-semibold text-tinte-900 dark:text-white text-center">{texts.groups.itemsSectionTitle}</h2>

	{#if items.length === 0}
		<p class="text-sm text-tinte-400 text-center">{texts.groups.noGroupItems}</p>
	{:else}
		<input
			type="search"
			bind:value={searchText}
			oninput={() => (visibleCount = PAGE_SIZE)}
			placeholder={texts.groups.itemSearchPlaceholder}
			aria-label={texts.groups.itemSearchPlaceholder}
			class="mx-auto block w-full max-w-xl rounded-full border border-tinte-300 bg-papier px-4 py-2 text-sm text-tinte-900 placeholder-tinte-400 focus:border-primary focus:ring-primary dark:border-tinte-600 dark:bg-tinte-700 dark:text-white"
		/>

		{#if categories.length > 0}
			<div class="flex flex-wrap justify-center gap-2">
				<button
					class="px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer
						{selectedCategory === null
							? 'bg-accent text-white'
							: 'bg-tinte-100 dark:bg-tinte-700 text-tinte-600 dark:text-tinte-300 hover:bg-tinte-200 dark:hover:bg-tinte-600'}"
					aria-pressed={selectedCategory === null}
					onclick={() => { selectedCategory = null; visibleCount = PAGE_SIZE; }}
				>
					{texts.groups.allCategories}
					<span class="ml-1 text-xs opacity-60">{textFilteredItems.length}</span>
				</button>
				{#each categories as cat (cat)}
					<button
						class="px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer
							{selectedCategory === cat
								? 'bg-accent text-white'
								: 'bg-tinte-100 dark:bg-tinte-700 text-tinte-600 dark:text-tinte-300 hover:bg-tinte-200 dark:hover:bg-tinte-600'}"
						aria-pressed={selectedCategory === cat}
						onclick={() => { selectedCategory = cat; visibleCount = PAGE_SIZE; }}
					>
						{cat}
						<span class="ml-1 text-xs opacity-60">{categoryCounts[cat]}</span>
					</button>
				{/each}
			</div>
		{/if}

		<div class="flex justify-center">
			<button
				type="button"
				aria-pressed={onlyAvailable}
				onclick={() => { onlyAvailable = !onlyAvailable; visibleCount = PAGE_SIZE; }}
				class="rounded-full border px-3 py-1 text-sm font-medium transition-colors cursor-pointer
					{onlyAvailable
						? 'bg-primary border-primary text-white'
						: 'border-tinte-300 bg-papier text-tinte-700 hover:border-primary hover:text-primary dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-300 dark:hover:border-primary dark:hover:text-primary'}"
			>
				{texts.pages.search.onlyAvailable}
			</button>
		</div>

		<!-- Announce the result count to screen readers, but only for an actual text search. -->
		<p class="sr-only" aria-live="polite">{normalizedSearch !== '' ? texts.ui.resultsFound(displayedItems.length) : ''}</p>

		{#if displayedItems.length === 0}
			<p class="text-tinte-500 dark:text-tinte-400 text-sm text-center">
				{normalizedSearch !== ''
					? texts.groups.noItemsForSearch
					: onlyAvailable
						? texts.groups.noAvailableItems
						: selectedCategory !== null
							? texts.groups.noItemsInCategory
							: texts.groups.noItemsForSearch}
			</p>
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{#each pagedItems as item (item.id)}
					<ItemCard
						{item}
						imgUrl={itemImageUrl(pbImgUrl, item) ?? ''}
						ownerImgUrl={item.profileImage
							? `${pbImgUrl}api/files/users/${item.userId}/${item.profileImage}`
							: undefined}
					/>
				{/each}
			</div>
			{#if displayedItems.length > pagedItems.length}
				<div class="flex justify-center pt-2">
					<Button variant="secondary" onclick={() => (visibleCount += PAGE_SIZE)}>
						{texts.groups.showMore(displayedItems.length - pagedItems.length)}
					</Button>
				</div>
			{/if}
		{/if}
	{/if}
</section>
