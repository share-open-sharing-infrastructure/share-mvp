<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { Section } from 'flowbite-svelte-blocks';
	import SearchBar from './SearchBar.svelte';
	import ResultsList from './ResultsList.svelte';
	import Pagination from './Pagination.svelte';
	import CategoryFilter from './CategoryFilter.svelte';
	import TravelTimeFilter from './TravelTimeFilter.svelte';
	import { texts } from '$lib/texts';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

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
			onlyAvailable={data.onlyAvailable}
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

	<div class="flex items-center gap-2 mt-3 text-sm text-tinte-600 dark:text-tinte-400">
		<input
			type="checkbox"
			id="onlyAvailable"
			checked={data.onlyAvailable}
			onchange={() => {
				const parts: string[] = [];
				if (data.q) parts.push(`q=${encodeURIComponent(data.q)}`);
				if (data.selectedCategories.length > 0) parts.push(`cats=${encodeURIComponent(data.selectedCategories.join(','))}`);
				if (data.op === 'and') parts.push('op=and');
				if (data.onlyAvailable) parts.push('onlyAvailable=false');
				goto(resolve('/search') + (parts.length ? '?' + parts.join('&') : ''));
			}}
			class="w-4 h-4 rounded accent-primary cursor-pointer"
		/>
		<label for="onlyAvailable" class="cursor-pointer">{texts.pages.search.onlyAvailable}</label>
	</div>

	{#if data.isRandom}
		<div class="w-full text-center mt-4 mb-2">
			<h5 class="text-tinte-500">{texts.pages.search.randomItemsHeading}</h5>
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
