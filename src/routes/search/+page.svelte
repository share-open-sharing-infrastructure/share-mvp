<script lang="ts">
	import { Section } from 'flowbite-svelte-blocks';
	import SearchBar from './SearchBar.svelte';
	import ResultsList from './ResultsList.svelte';
	import Pagination from './Pagination.svelte';
	import HowToButton from './HowToButton.svelte';
	import CategoryFilter from './CategoryFilter.svelte';
	// import TransportModeSelector from './TransportModeSelector.svelte';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	// import { SvelteMap } from 'svelte/reactivity';

	// type TransportMode = 'foot' | 'bicycle' | 'car';

	const { data } = $props();

	const browseAllUrl = resolve('/search') + '?q=*';

	// Transport mode and travel time features are temporarily disabled pending fixes
	// let transportMode: TransportMode = $state(
	// 	(data.currentUser?.preferredTransportMode as TransportMode) ?? 'bicycle'
	// );
	// let travelTimes = $state<Record<string, number | null>>({});
	// let maxMinutes = $state(60);
	// let noLocationAvailable = $state(false);
	// let showNoLocationPrompt = $state(false);
	// let userLocation: { lon: number; lat: number } | null = null;
	// const travelTimesCache = new SvelteMap<TransportMode, Record<string, number | null>>();

	// function isNullIsland(loc: { lon: number; lat: number } | undefined | null) {
	// 	return !loc || (loc.lon === 0 && loc.lat === 0);
	// }

	// async function fetchTravelTimes() {
	// 	if (!userLocation || data.items.length === 0) return;
	// 	const ownerMap = new SvelteMap<string, { id: string; lon: number; lat: number }>();
	// 	const ownerlessIds: string[] = [];
	// 	for (const item of data.items) {
	// 		const owner = item.expand?.owner;
	// 		if (!owner?.id) continue;
	// 		if (ownerMap.has(owner.id) || ownerlessIds.includes(owner.id)) continue;
	// 		const geo = owner.geolocation;
	// 		if (isNullIsland(geo)) {
	// 			ownerlessIds.push(owner.id);
	// 		} else {
	// 			ownerMap.set(owner.id, { id: owner.id, lon: geo.lon, lat: geo.lat });
	// 		}
	// 	}
	// 	const newTimes: Record<string, number | null> = {};
	// 	for (const id of ownerlessIds) newTimes[id] = null;
	// 	const owners = Array.from(ownerMap.values());
	// 	if (owners.length === 0) { travelTimes = newTimes; return; }
	// 	const cached = travelTimesCache.get(transportMode);
	// 	if (cached) { travelTimes = { ...newTimes, ...cached }; return; }
	// 	try {
	// 		const response = await fetch('/api/travel-times', {
	// 			method: 'POST',
	// 			headers: { 'Content-Type': 'application/json' },
	// 			body: JSON.stringify({ userLocation, transportMode, owners }),
	// 		});
	// 		if (response.ok) {
	// 			const result: Record<string, number> = await response.json();
	// 			const merged = { ...newTimes, ...result };
	// 			travelTimesCache.set(transportMode, result);
	// 			travelTimes = merged;
	// 		}
	// 	} catch (err) {
	// 		console.error('Travel time fetch failed:', err);
	// 		travelTimes = newTimes;
	// 	}
	// }

	// async function handleTransportModeChange(mode: TransportMode) {
	// 	transportMode = mode;
	// 	if (noLocationAvailable) { showNoLocationPrompt = true; return; }
	// 	showNoLocationPrompt = false;
	// 	if (userLocation) await fetchTravelTimes();
	// 	if (data.currentUser) {
	// 		const fd = new FormData();
	// 		fd.append('mode', mode);
	// 		fetch('?/saveTransportMode', { method: 'POST', body: fd }).catch(
	// 			(err) => console.error('Failed to save transport mode:', err)
	// 		);
	// 	}
	// }

	// $effect(() => {
	// 	if (typeof navigator === 'undefined') return;
	// 	navigator.geolocation.getCurrentPosition(
	// 		(pos) => {
	// 			userLocation = { lon: pos.coords.longitude, lat: pos.coords.latitude };
	// 			fetchTravelTimes();
	// 		},
	// 		() => {
	// 			const profileGeo = data.currentUser?.geolocation;
	// 			if (!isNullIsland(profileGeo)) {
	// 				userLocation = profileGeo!;
	// 				fetchTravelTimes();
	// 			} else {
	// 				noLocationAvailable = true;
	// 			}
	// 		}
	// 	);
	// });
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

	<!-- Transport mode and travel time filter — temporarily disabled pending fixes
	<div class="flex flex-wrap justify-center items-center gap-3 mt-3">
		<TransportModeSelector mode={transportMode} onchange={handleTransportModeChange} />
		<span>Filtern:</span>
		<div class="flex items-center gap-2">
			<input
				type="range"
				min="5"
				max="60"
				step="5"
				bind:value={maxMinutes}
				class="w-32 h-2 accent-primary cursor-pointer"
			/>
			<span class="text-sm text-gray-600 dark:text-gray-300 w-28">
				{maxMinutes >= 60
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
	-->

	{#if data.q || data.selectedCategories.length > 0}
		<ResultsList
			filteredItemList={data.items}
			PB_IMG_URL={data.PB_IMG_URL}
			travelTimes={{}}
			transportMode="bicycle"
			totalItems={data.totalItems}
		/>
		<Pagination
			page={data.page}
			totalPages={data.totalPages}
			perPage={data.perPage}
			q={data.q}
			selectedCategories={data.selectedCategories}
			op={data.op}
		/>
	{/if}
</Section>

<HowToButton />
