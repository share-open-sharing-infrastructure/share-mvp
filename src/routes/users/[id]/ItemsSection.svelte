<script lang="ts">
	import { texts } from '$lib/texts';
	import { itemImageUrl } from '$lib/utils/utils';
	import type { Item, ItemPublic } from '$lib/types/models';
	import ItemCard from '../../search/ItemCard.svelte';
	import LockedItemCard from './LockedItemCard.svelte';

	interface Props {
		publicItems: Item[];
		trustedItems: Item[] | null;
		hiddenItemsCount: number;
		hiddenCategories: string[];
		profileImageUrl: string | null;
		pbImgUrl: string;
		loggedIn: boolean;
	}

	const { publicItems, trustedItems, hiddenItemsCount, hiddenCategories, profileImageUrl, pbImgUrl, loggedIn }: Props = $props();

	let selectedCategory = $state<string | null>(null);
	let searchText = $state('');

	const allVisibleItems = $derived([...publicItems, ...(trustedItems ?? [])]);

	// Free-text filter over the already-loaded items (in-memory, no extra request).
	const normalizedSearch = $derived(searchText.trim().toLowerCase());

	const categories = $derived(
		[...new Set([
			...allVisibleItems.flatMap((i) => i.categories ?? []),
			...hiddenCategories,
		])].sort()
	);

	const categoryCounts = $derived(
		Object.fromEntries(
			categories.map((cat) => [cat, allVisibleItems.filter((i) => (i.categories ?? []).includes(cat)).length])
		)
	);

	const hiddenCategoryCounts = $derived(
		hiddenCategories.reduce<Record<string, number>>((acc, cat) => {
			acc[cat] = (acc[cat] ?? 0) + 1;
			return acc;
		}, {})
	);

	const displayedItems = $derived(
		allVisibleItems
			.filter((i) => selectedCategory === null || (i.categories ?? []).includes(selectedCategory))
			.filter(
				(i) =>
					normalizedSearch === '' ||
					`${i.name ?? ''} ${i.description ?? ''}`.toLowerCase().includes(normalizedSearch)
			)
	);

	const ghostIndices = $derived(
		// Hidden items can't be matched by the text filter, so suppress the locked placeholders while searching.
		trustedItems !== null || normalizedSearch !== ''
			? []
			: Array.from(
				{ length: Math.min(selectedCategory === null ? hiddenItemsCount : (hiddenCategoryCounts[selectedCategory] ?? 0), 3) },
				(_, i) => i
			)
	);
</script>

<section class="space-y-4">
	<h2 class="text-sm font-semibold text-tinte-500 dark:text-tinte-400 uppercase tracking-wide">
		{texts.pages.userProfile.itemsSectionTitle}
	</h2>

	{#if allVisibleItems.length > 0}
		<input
			type="search"
			bind:value={searchText}
			placeholder={texts.pages.userProfile.itemSearchPlaceholder}
			aria-label={texts.pages.userProfile.itemSearchPlaceholder}
			class="w-full rounded-full border border-tinte-300 bg-papier px-4 py-2 text-sm text-tinte-900 placeholder:text-tinte-400 focus:border-primary focus:ring-primary dark:border-tinte-600 dark:bg-tinte-800 dark:text-white"
		/>
	{/if}

	{#if categories.length > 0}
		<div class="flex flex-wrap gap-2">
			<button
				class="px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer
					{selectedCategory === null
						? 'bg-accent text-white'
						: 'bg-tinte-100 dark:bg-tinte-700 text-tinte-600 dark:text-tinte-300 hover:bg-tinte-200 dark:hover:bg-tinte-600'}"
				aria-pressed={selectedCategory === null}
				onclick={() => (selectedCategory = null)}
			>
				{texts.pages.userProfile.allCategories}
				<span class="ml-1 text-xs opacity-60">{allVisibleItems.length}{#if hiddenItemsCount > 0}&nbsp;(+{hiddenItemsCount}){/if}</span>
			</button>
			{#each categories as cat (cat)}
				<button
					class="px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer
						{selectedCategory === cat
							? 'bg-accent text-white'
							: 'bg-tinte-100 dark:bg-tinte-700 text-tinte-600 dark:text-tinte-300 hover:bg-tinte-200 dark:hover:bg-tinte-600'}"
					aria-pressed={selectedCategory === cat}
					onclick={() => (selectedCategory = cat)}
				>
					{cat}
					<span class="ml-1 text-xs opacity-60">{categoryCounts[cat]}{#if hiddenCategoryCounts[cat]}&nbsp;(+{hiddenCategoryCounts[cat]}){/if}</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if displayedItems.length === 0 && ghostIndices.length === 0}
		<p class="text-tinte-500 dark:text-tinte-400 text-sm">
			{normalizedSearch !== ''
				? texts.pages.userProfile.noItemsForSearch
				: selectedCategory !== null
					? texts.pages.userProfile.noItemsInCategory
					: texts.pages.userProfile.noItemsOnProfile}
		</p>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			{#each displayedItems as item (item.id)}
				<ItemCard
					item={item as unknown as ItemPublic}
					imgUrl={itemImageUrl(pbImgUrl, item) ?? ''}
					ownerImgUrl={profileImageUrl ?? undefined}
					profileView={true}
				/>
			{/each}
			{#each ghostIndices as i (i)}
				{@const hiddenCount = selectedCategory === null ? hiddenItemsCount : (hiddenCategoryCounts[selectedCategory] ?? 0)}
				<LockedItemCard
					id="locked-item-{i}"
					{loggedIn}
					isOverflow={hiddenCount > 3 && i === 2}
					overflowCount={hiddenCount - 2}
				/>
			{/each}
		</div>
	{/if}
</section>
