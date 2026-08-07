<script lang="ts">
	import { goto } from '$app/navigation';
	import { Section } from 'flowbite-svelte-blocks';
	import SearchBar from './SearchBar.svelte';
	import ResultsList from './ResultsList.svelte';
	import Pagination from './Pagination.svelte';
	import FilterModal from './FilterModal.svelte';
	import TravelTimeFilter from './TravelTimeFilter.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { FilterOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import { buildSearchUrl } from './searchUrl';
	import type { OwnerType, FilterDraft } from './searchFilter';
	import SeoHead from '$lib/components/SeoHead.svelte';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	const { data } = $props();

	const preferredMode = $derived(
		(data.currentUserPreferences?.preferredTransportMode || undefined) as TransportMode | undefined
	);

	let transportMode = $state<TransportMode | null>(null);
	let travelTimes = $state<Record<string, number>>({});
	let maxMinutes = $state(30);
	let filterModalOpen = $state(false);

	const filterActive = $derived(maxMinutes < 30 && Object.keys(travelTimes).length > 0);

	// Active-filter count for the trigger button's badge. Only counts what's settable inside the
	// modal — Entfernung lives inline with its own visible active state, so counting it here too
	// would double-count. Sort isn't counted (it's an ordering preference, not a constraint on the
	// result set).
	const activeFilterCount = $derived(
		(data.onlyAvailable ? 1 : 0) +
			(data.ownerType !== 'all' ? 1 : 0) +
			(data.selectedCategories.length > 0 ? 1 : 0) +
			(data.selectedGroup ? 1 : 0)
	);

	function handleApply(draft: FilterDraft) {
		filterModalOpen = false;
		// Single navigation commits every draft field at once; page resets to default (omitted).
		const url = buildSearchUrl({
			q: data.q,
			sort: draft.sort,
			onlyAvailable: draft.onlyAvailable,
			ownerType: draft.ownerType,
			cats: draft.selectedCategories,
			group: draft.selectedGroup ?? undefined,
		});
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- buildSearchUrl() returns an already-resolved URL; the rule cannot see through the call
		goto(url);
	}

	const filteredItems = $derived.by(() => {
		const items = filterActive
			? (data.items ?? []).filter((item) => {
					const minutes = travelTimes[item.userId];
					return minutes === undefined || minutes <= maxMinutes;
				})
			: [...(data.items ?? [])];

		if (Object.keys(travelTimes).length === 0) return items;

		return items.sort((a, b) => {
			const aMin = travelTimes[a.userId];
			const bMin = travelTimes[b.userId];
			if (aMin === undefined && bMin === undefined) return 0;
			if (aMin === undefined) return 1;
			if (bMin === undefined) return -1;
			return aMin - bMin;
		});
	});
</script>

<SeoHead title={texts.seo.search.title} description={texts.seo.search.description} />

{#snippet filterSlot()}
	<Button
		variant="primary"
		onclick={() => (filterModalOpen = true)}
		class="shrink-0"
		aria-label={activeFilterCount > 0
			? texts.pages.search.filterButtonActive(activeFilterCount)
			: texts.pages.search.filterButton}
	>
		<span class="relative inline-flex items-center">
			<FilterOutline class="shrink-0 h-6 w-6" />
			{#if activeFilterCount > 0}
				<span
					class="absolute -top-2 -right-3 min-w-[1.1rem] h-[1.1rem] bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none"
				>
					{activeFilterCount}
				</span>
			{/if}
		</span>
	</Button>
{/snippet}

{#snippet paginationControls()}
	{#if filterActive}
		<p class="text-center text-sm text-tinte-500 mt-2">
			{texts.pages.search.durationFilter.paginationHidden}
		</p>
	{:else}
		<Pagination
			page={data.page}
			totalPages={data.totalPages}
			perPage={data.perPage}
			q={data.q}
			selectedCategories={data.selectedCategories}
			onlyAvailable={data.onlyAvailable}
			ownerType={data.ownerType}
			group={data.selectedGroup}
			sort={data.sort}
		/>
	{/if}
{/snippet}

<!-- HEADER -->
<div class="mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center">
		<!-- h1, not h2: /search is in the sitemap, reachable without auth, and carries no
		     noindex — an indexable landing page without an h1. Classes unchanged (Tailwind
		     Preflight strips heading styling), the swap has no visual effect. -->
		<h1 class="text-2xl tracking-tight font-extrabold text-tinte-900 dark:text-white">
			{texts.pages.search.title}
		</h1>
	</div>
</div>

<Section class="max-w-5xl mx-auto py-0 xs:py-0">
	<SearchBar q={data.q} {filterSlot} />

	<div class="flex flex-wrap justify-center items-center gap-2 my-3">
		<TravelTimeFilter
			{preferredMode}
			isLoggedIn={!!data.currentUser}
			hasQuery={data.q.length > 0 || data.selectedCategories.length > 0 || !!data.selectedGroup}
			items={data.items ?? []}
			bind:transportMode
			bind:travelTimes
			bind:maxMinutes
		/>
	</div>

	<FilterModal
		bind:open={filterModalOpen}
		sort={data.sort}
		onlyAvailable={data.onlyAvailable}
		ownerType={data.ownerType as OwnerType}
		selectedCategories={data.selectedCategories}
		selectedGroup={data.selectedGroup}
		groups={data.attachableGroups}
		onApply={handleApply}
	/>

	<!--
		Status line, NOT a heading. This used to be two <h5>s — the right fix for the resulting
		`heading-order` jump under the new h1 isn't a higher heading, it's no heading at all:
		"12 items found" is a status message, not a section heading. As a heading, /search's
		document outline would be unstable (the text changes on every filter) and screen readers
		would announce the role on every result update ("heading level 2, 12 items found").
		WCAG 1.3.1.
		`role="status"` already implies `aria-live="polite"` and `aria-atomic="true"`; both are
		still listed explicitly as a defensive measure, because some older screen reader/browser
		combinations don't reliably apply the implicit values. No `aria-busy` — the line has no
		loading state of its own, result updates go through SvelteKit navigation, and the global
		loader in `+layout.svelte` already covers that.
	-->
	<div
		class="w-full items-center justify-center text-center mt-2"
		role="status"
		aria-live="polite"
		aria-atomic="true"
	>
		{#if data.q || data.selectedCategories.length > 0 || data.selectedGroup}
			<p>{texts.ui.resultsFound(filterActive ? filteredItems.length : (data.totalItems ?? 0))}</p>
		{:else}
			<p>{texts.pages.search.newestItemsHeading}</p>
		{/if}
	</div>

	{@render paginationControls()}

	<ResultsList
		filteredItemList={filteredItems}
		PB_IMG_URL={data.PB_IMG_URL}
		{travelTimes}
		transportMode={transportMode ?? undefined}
	/>

	{@render paginationControls()}
</Section>
