<script lang="ts">
	import { Section } from 'flowbite-svelte-blocks';
	import type { Item } from '$lib/types/models';
	import SearchBar from './SearchBar.svelte';
	import ResultsList from './ResultsList.svelte';
	import HowToButton from './HowToButton.svelte';
	import TransportModeSelector from './TransportModeSelector.svelte';
	import { texts } from '$lib/texts';
	import { SvelteMap } from 'svelte/reactivity';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	const { data } = $props();
	// svelte-ignore state_referenced_locally
	const { items } = data;

	let selectedPlaces: string[] = $state([]);
	let searchText = $state({ value: '' });

	// Transport mode — read from user profile, default to bicycle
	// svelte-ignore state_referenced_locally
	let transportMode: TransportMode = $state(
		(data.currentUser?.preferredTransportMode as TransportMode) ?? 'bicycle'
	);

	// Travel times: ownerId → minutes (null means owner has no geolocation)
	let travelTimes = $state<Record<string, number | null>>({});

	// Whether the current user has no resolvable location
	let noLocationAvailable = $state(false);
	// Show no-location prompt when user interacts with transport selector without a location
	let showNoLocationPrompt = $state(false);

	// Helper for case insensitive search
	const includesCaseInsensitive = (str: string, searchString: string) =>
		str.toLowerCase().includes(searchString.toLowerCase());

	let isSearching: boolean = $derived(searchText.value.length > 0);

	// Filters and sorts result set based on selected filters, search text, and travel times
	let filteredItemList: Item[] = $derived(
		items
			.filter((item: Item) => {
				if (selectedPlaces.length > 0 && !selectedPlaces.includes(item.place)) {
					return false;
				}
				if (
					searchText.value.length &&
					!includesCaseInsensitive(item.name, searchText.value)
				) {
					return false;
				}
				return true;
			})
			.sort((a: Item, b: Item) => {
				const ownA = a.expand?.owner?.id;
				const ownB = b.expand?.owner?.id;
				const tA = ownA !== undefined ? travelTimes[ownA] : undefined;
				const tB = ownB !== undefined ? travelTimes[ownB] : undefined;
				// null or undefined = no travel time known → sort to bottom
				const valA = tA === null || tA === undefined ? Infinity : tA;
				const valB = tB === null || tB === undefined ? Infinity : tB;
				return valA - valB;
			})
	);

	let userLocation: { lon: number; lat: number } | null = null;
	const travelTimesCache = new SvelteMap<TransportMode, Record<string, number | null>>();

	function isNullIsland(loc: { lon: number; lat: number } | undefined | null) {
		return !loc || (loc.lon === 0 && loc.lat === 0);
	}

	async function fetchTravelTimes() {
		if (!userLocation || items.length === 0) return;

		// Collect unique owners, split into those with and without geolocation
		const ownerMap = new SvelteMap<string, { id: string; lon: number; lat: number }>();
		const ownerlessIds: string[] = [];

		for (const item of items) {
			const owner = item.expand?.owner;
			if (!owner?.id) continue;
			if (ownerMap.has(owner.id) || ownerlessIds.includes(owner.id)) continue;

			const geo = owner.geolocation;
			if (isNullIsland(geo)) {
				ownerlessIds.push(owner.id);
			} else {
				ownerMap.set(owner.id, { id: owner.id, lon: geo.lon, lat: geo.lat });
			}
		}

		// Pre-fill owners without geolocation as null
		const newTimes: Record<string, number | null> = {};
		for (const id of ownerlessIds) {
			newTimes[id] = null;
		}

		const owners = Array.from(ownerMap.values());
		if (owners.length === 0) {
			travelTimes = newTimes;
			return;
		}

		// Return cached result if this mode was already fetched
		const cached = travelTimesCache.get(transportMode);
		if (cached) {
			travelTimes = { ...newTimes, ...cached };
			return;
		}

		try {
			const response = await fetch('/api/travel-times', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userLocation, transportMode, owners }),
			});
			if (response.ok) {
				const result: Record<string, number> = await response.json();
				const merged = { ...newTimes, ...result };
				travelTimesCache.set(transportMode, result);
				travelTimes = merged;
			}
		} catch (err) {
			console.error('Travel time fetch failed:', err);
			travelTimes = newTimes;
		}
	}

	// On mount: resolve user location via browser geolocation, fall back to profile
	$effect(() => {
		if (typeof navigator === 'undefined') return;

		navigator.geolocation.getCurrentPosition(
			(pos) => {
				userLocation = { lon: pos.coords.longitude, lat: pos.coords.latitude };
				fetchTravelTimes();
			},
			() => {
				// Browser denied — fall back to profile geolocation
				const profileGeo = data.currentUser?.geolocation;
				if (!isNullIsland(profileGeo)) {
					userLocation = profileGeo!;
					fetchTravelTimes();
				} else {
					noLocationAvailable = true;
				}
			}
		);
	});

	async function handleTransportModeChange(mode: TransportMode) {
		transportMode = mode;

		if (noLocationAvailable) {
			showNoLocationPrompt = true;
			return;
		}
		showNoLocationPrompt = false;

		// Re-fetch travel times with new mode
		if (userLocation) {
			await fetchTravelTimes();
		}

		// Save to profile (fire and forget, only for logged-in users)
		if (data.currentUser) {
			const fd = new FormData();
			fd.append('mode', mode);
			fetch('?/saveTransportMode', { method: 'POST', body: fd }).catch(
				(err) => console.error('Failed to save transport mode:', err)
			);
		}
	}
</script>

<!-- HEADER -->
<div class="px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center">
		<h2
			class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white"
		>
			{texts.pages.search.title}
		</h2>
	</div>
</div>

<Section class="max-w-5xl mx-auto py-0">
	<SearchBar {searchText} {isSearching} />

	<div class="flex justify-center mt-3">
		<TransportModeSelector mode={transportMode} onchange={handleTransportModeChange} />
	</div>

	{#if showNoLocationPrompt}
		<p class="text-center text-sm text-gray-500 mt-2">
			{texts.pages.search.noLocation}
		</p>
	{/if}

	<ResultsList
		{filteredItemList}
		PB_IMG_URL={data.PB_IMG_URL}
		{travelTimes}
		{transportMode}
	/>
</Section>

<HowToButton />
