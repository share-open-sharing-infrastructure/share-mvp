<script lang="ts">
	import { Section } from 'flowbite-svelte-blocks';
	import SearchBar from './SearchBar.svelte';
	import ResultsList from './ResultsList.svelte';
	import Pagination from './Pagination.svelte';
	import HowToButton from './HowToButton.svelte';
	import CategoryFilter from './CategoryFilter.svelte';
	import TransportModeSelector from './TransportModeSelector.svelte';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import type { OwnerLocation } from '$lib/types/models';
	import { untrack, onMount } from 'svelte';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	const { data } = $props();

	const browseAllUrl = resolve('/search') + '?q=*';

	const initialMode = untrack(() => (data.currentUser?.preferredTransportMode as TransportMode) ?? 'bicycle');
	let transportMode: TransportMode = $state(initialMode);
	let travelTimes = $state<Record<string, number>>({});
	let maxMinutes = $state(30);
	let filterActive = $derived(maxMinutes < 30 && Object.keys(travelTimes).length > 0);
	let filteredItems = $derived.by(() => {
		const items = filterActive
			? data.items.filter((item) => {
					const minutes = travelTimes[item.expand?.owner?.id ?? ''];
					return minutes === undefined || minutes <= maxMinutes;
				})
			: [...data.items];

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
	let showNoLocationPrompt = $state(false);
	let cachedUserLocation: { lon: number; lat: number } | null = null;

	function extractOwnerLocations(): OwnerLocation[] {
		const seen: Record<string, true> = {};
		const result: OwnerLocation[] = [];
		for (const item of data.items) {
			const owner = item.expand?.owner;
			if (!owner?.id || seen[owner.id]) continue;
			const geo = owner.geolocation as { lon: number; lat: number } | undefined;
			if (geo && !(geo.lon === 0 && geo.lat === 0)) {
				seen[owner.id] = true;
				result.push({ id: owner.id, lon: geo.lon, lat: geo.lat });
			}
		}
		return result;
	}

	async function fetchTravelTimes(mode: TransportMode, userLocation: { lon: number; lat: number }) {
		const owners = extractOwnerLocations();
		if (owners.length === 0) return;
		try {
			const response = await fetch('/api/travel-times', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userLocation, transportMode: mode, owners }),
			});
			if (response.ok) travelTimes = await response.json();
		} catch (err) {
			console.error('Travel time fetch failed:', err);
		}
	}

	function requestLocationAndFetch(mode: TransportMode) {
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				cachedUserLocation = { lon: pos.coords.longitude, lat: pos.coords.latitude };
				fetchTravelTimes(mode, cachedUserLocation);
			},
			() => {
				showNoLocationPrompt = true;
			}
		);
	}

	async function handleTransportModeChange(mode: TransportMode) {
		transportMode = mode;
		showNoLocationPrompt = false;

		if (data.currentUser) {
			const fd = new FormData();
			fd.append('mode', mode);
			fetch('?/saveTransportMode', { method: 'POST', body: fd }).catch(
				(err) => console.error('Failed to save transport mode:', err)
			);
		}

		if (cachedUserLocation) {
			fetchTravelTimes(mode, cachedUserLocation);
			return;
		}

		requestLocationAndFetch(mode);
	}

	onMount(() => {
		if (data.currentUser) requestLocationAndFetch(transportMode);
	});
</script>

<!-- HEADER -->
<div class="px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center">
		<h2 class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white">
			{texts.pages.search.title}
		</h2>
	</div>
</div>

<Section class="max-w-5xl mx-auto py-0">
	<SearchBar q={data.q} />

	<div class="mt-2 text-center">
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={browseAllUrl} class="text-sm text-primary hover:underline">
			{texts.pages.search.browseAll}
		</a>
	</div>

	<CategoryFilter
		selectedCategories={data.selectedCategories}
		op={data.op}
		q={data.q}
		perPage={data.perPage}
	/>

	<!-- Transport Mode filter (logged-in users only) -->
	{#if data.currentUser}
		<div class="flex flex-wrap justify-center items-center gap-3 mt-3">
			<TransportModeSelector mode={transportMode} onchange={handleTransportModeChange} />
			<span>Filtern:</span>
			<div class="flex items-center gap-2">
				<input
					type="range"
					min="5"
					max="30"
					step="5"
					bind:value={maxMinutes}
					class="w-32 h-2 accent-primary cursor-pointer"
				/>
				<span class="text-sm text-gray-600 dark:text-gray-300 w-28">
					{maxMinutes >= 30
						? texts.pages.search.durationFilter.noLimit
						: texts.pages.search.durationFilter.maxMinutes(maxMinutes)}
				</span>
			</div>
		</div>
		{#if showNoLocationPrompt}
			<p class="text-center text-sm text-gray-500 mt-2">
				{texts.pages.search.noLocation}
			</p>
		{/if}
	{/if}
	

	{#if data.q || data.selectedCategories.length > 0}
		<ResultsList
			filteredItemList={filteredItems}
			PB_IMG_URL={data.PB_IMG_URL}
			travelTimes={travelTimes}
			transportMode={transportMode}
			totalItems={filterActive ? filteredItems.length : data.totalItems}
			currentUserId={data.currentUser?.id}
		/>
		{#if filterActive}
			<p class="text-center text-sm text-gray-500 mt-2">
				{texts.pages.search.durationFilter.paginationHidden}
			</p>
		{/if}
		{#if !filterActive}
			<Pagination
				page={data.page}
				totalPages={data.totalPages}
				perPage={data.perPage}
				q={data.q}
				selectedCategories={data.selectedCategories}
				op={data.op}
			/>
		{/if}
	{/if}
</Section>

<HowToButton />
