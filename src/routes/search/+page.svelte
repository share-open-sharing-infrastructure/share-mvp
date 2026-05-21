<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { Section } from 'flowbite-svelte-blocks';
	import SearchBar from './SearchBar.svelte';
	import ResultsList from './ResultsList.svelte';
	import Pagination from './Pagination.svelte';
	import CategoryFilter from './CategoryFilter.svelte';
	import TravelTimeFilter from './TravelTimeFilter.svelte';
	import { texts } from '$lib/texts';
	import { invalidateAll } from '$app/navigation';
	import { ShuffleOutline, ArrowsRepeatOutline } from 'flowbite-svelte-icons';
	import { buildSearchUrl } from './searchUrl';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	const { data } = $props();

	const preferredMode = $derived(
		(data.currentUser?.preferredTransportMode || undefined) as TransportMode | undefined
	);

	let transportMode = $state<TransportMode | null>(null);
	let travelTimes = $state<Record<string, number>>({});
	let maxMinutes = $state(30);

	const filterActive = $derived(maxMinutes < 30 && Object.keys(travelTimes).length > 0);

	function searchUrl(overrides: { onlyAvailable?: boolean; ownerType?: string } = {}): string {
		return buildSearchUrl({
			q: data.q,
			cats: data.selectedCategories,
			op: data.op,
			onlyAvailable: overrides.onlyAvailable ?? data.onlyAvailable,
			ownerType: overrides.ownerType ?? data.ownerType,
		});
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
			onlyAvailable={data.onlyAvailable}
			ownerType={data.ownerType}
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
		onlyAvailable={data.onlyAvailable}
		ownerType={data.ownerType}
	/>

	<hr class="border-tinte-300 max-w-100! my-2 mx-auto"/>

	{@const ownerTypeNext = { all: 'institution', institution: 'private', private: 'all' } as const}
	{@const ownerTypeLabel = {
		all: texts.pages.search.ownerTypeAll,
		institution: texts.pages.search.ownerTypeInstitution,
		private: texts.pages.search.ownerTypePrivate,
	} as const}

	<div class="flex flex-wrap justify-center items-center gap-1 my-3">
		<a
			href={searchUrl({ onlyAvailable: !data.onlyAvailable })}
			class="rounded-full border px-3 py-1 text-sm font-medium transition-colors
				{data.onlyAvailable
				? 'bg-primary border-primary text-white'
				: 'border-tinte-300 bg-papier text-tinte-700 hover:border-primary hover:text-primary dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-300 dark:hover:border-primary dark:hover:text-primary'}"
		>{texts.pages.search.onlyAvailable}</a>

		<a
			href={searchUrl({ ownerType: ownerTypeNext[data.ownerType as keyof typeof ownerTypeNext] })}
			class="flex items-center rounded-full border px-3 py-1 text-sm font-medium transition-colors border-tinte-300 bg-papier text-tinte-700 hover:border-primary hover:text-primary dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-300 dark:hover:border-primary dark:hover:text-primary"
		><ArrowsRepeatOutline class="mr-1 h-4 w-4 shrink-0" />{texts.pages.search.ownerTypePrefix}: {ownerTypeLabel[data.ownerType as keyof typeof ownerTypeLabel]}</a>

	</div>

	<hr class="border-tinte-300 max-w-100! my-2 mx-auto"/>

	<TravelTimeFilter
		{preferredMode}
		isLoggedIn={!!data.currentUser}
		hasQuery={data.q.length > 0 || data.selectedCategories.length > 0}
		items={data.items ?? []}
		bind:transportMode
		bind:travelTimes
		bind:maxMinutes
	/>

	{#if data.isRandom}
		<div class="w-full text-center mt-4 mb-2 flex flex-col items-center gap-2">

			<button
				onclick={() => invalidateAll()}
				class="flex rounded-full hover:cursor-pointer border px-3 py-1 text-sm font-medium transition-colors border-tinte-300 bg-papier text-tinte-700 hover:border-primary hover:text-primary dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-300 dark:hover:border-primary dark:hover:text-primary"
			>
			<ShuffleOutline class="mr-1"></ShuffleOutline>
			{texts.pages.search.randomItemsHeading}
		</button>
		</div>
	{/if}

	{#if data.q || data.selectedCategories.length > 0}
		<div class="w-full items-center justify-center text-center mt-2">
			<h5>{texts.ui.resultsFound(filterActive ? filteredItems.length : data.totalItems ?? 0)}</h5>
		</div>
	{/if}

	{@render paginationControls()}

	{#if data.q || data.selectedCategories.length > 0 || data.isRandom}
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
