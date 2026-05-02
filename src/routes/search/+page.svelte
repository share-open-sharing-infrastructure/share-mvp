<script lang="ts">
	import { Section } from 'flowbite-svelte-blocks';
	import SearchBar from './SearchBar.svelte';
	import ResultsList from './ResultsList.svelte';
	import Pagination from './Pagination.svelte';
	import CategoryFilter from './CategoryFilter.svelte';
	import TravelTimeFilter from './TravelTimeFilter.svelte';
	import { texts } from '$lib/texts';
	import { page } from '$app/state';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	const { data } = $props();

	const preferredMode = $derived(
		(data.currentUser?.preferredTransportMode || undefined) as TransportMode | undefined
	);

	let transportMode = $state<TransportMode | null>(null);
	let travelTimes = $state<Record<string, number>>({});
	let maxMinutes = $state(30);

	const filterActive = $derived(maxMinutes < 30 && Object.keys(travelTimes).length > 0);
	const filteredItems = $derived.by(() => {
		const items = filterActive
			? (data.items ?? []).filter((item) => {
					const minutes = travelTimes[item.expand?.owner?.id ?? ''];
					return minutes === undefined || minutes <= maxMinutes;
				})
			: [...(data.items ?? [])];

		if (Object.keys(travelTimes).length === 0) return items;

		return items.sort((a, b) => {
			const aMin = travelTimes[a.expand?.owner?.id ?? ''];
			const bMin = travelTimes[b.expand?.owner?.id ?? ''];
			if (aMin === undefined && bMin === undefined) return 0;
			if (aMin === undefined) return 1;
			if (bMin === undefined) return -1;
			return aMin - bMin;
		});
	});
</script>

<svelte:head>
	<title>{texts.seo.search.title}</title>
	<meta name="description" content={texts.seo.search.description} />
	<meta property="og:title" content={texts.seo.search.title} />
	<meta property="og:description" content={texts.seo.search.description} />
	<meta property="og:type" content="website" />
</svelte:head>

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
			op={data.op}
		/>
	{/if}
{/snippet}

<!-- HEADER -->
<div class="px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center">
		<h2 class="text-2xl tracking-tight font-extrabold text-tinte-900 dark:text-white">
			{texts.pages.search.title}
		</h2>
	</div>
</div>

<Section class="max-w-5xl mx-auto py-0">
	<SearchBar q={data.q} />

	<CategoryFilter
		selectedCategories={data.selectedCategories}
		op={data.op}
		q={data.q}
		perPage={data.perPage}
	/>

	<TravelTimeFilter
		{preferredMode}
		isLoggedIn={!!data.currentUser}
		hasQuery={data.q.length > 0 || data.selectedCategories.length > 0}
		items={data.items ?? []}
		bind:transportMode
		bind:travelTimes
		bind:maxMinutes
	/>

	{#if data.q || data.selectedCategories.length > 0}
		<div class="w-full items-center justify-center text-center mt-2">
			<h5>{texts.ui.resultsFound(filterActive ? filteredItems.length : data.totalItems ?? 0)}</h5>
		</div>
	{/if}
			
	{@render paginationControls()}

	{#if data.q || data.selectedCategories.length > 0}
		<ResultsList
			filteredItemList={filteredItems}
			PB_IMG_URL={data.PB_IMG_URL}
			{travelTimes}
			transportMode={transportMode ?? undefined}
			currentUserId={data.currentUser?.id}
		/>
	{/if}

	{@render paginationControls()}
</Section>
