<script lang="ts">
	const { data } = $props();
	const { items, uniquePlaces } = data;
	import { Section } from 'flowbite-svelte-blocks';
	import type { Item } from '$lib/types/models';
	import SearchBar from './SearchBar.svelte';
	import Welcome from './Welcome.svelte';
	import ResultsList from './ResultsList.svelte';

	let selectedPlaces: string[] = $state([]);
	let searchText = $state({value: ''});

	// Helper for case insensitive search
	const includesCaseInsensitive = (str: string, searchString: string) =>
		str.toLowerCase().includes(searchString.toLowerCase());

	let isSearching: boolean = $derived(searchText.value.length > 0);

	// Filters result set item list based on selected filters and search text
	let filteredItemList: Item[] = $derived(
		items.filter((item: Item) => {

			// Filter by selected places
			if (selectedPlaces.length > 0 && !selectedPlaces.includes(item.place)) {
				return false;
			}

			// Filter by search text
			if (searchText.value.length && !includesCaseInsensitive(item.name, searchText.value)) {
				return false;
			}

			return true;
		})
	);
</script>

<Section>

	<SearchBar
		searchText={searchText}
		isSearching={isSearching}
		selectedPlaces={selectedPlaces}
		uniquePlaces={uniquePlaces}
	/>

	<div class="mx-auto max-w-5xl space-y-4 overflow-x-auto p-4 md:space-y-6">
		{#if isSearching}
			<ResultsList 
				filteredItemList={filteredItemList} 
				PB_IMG_URL={data.PB_IMG_URL}
			/>
		{:else}
			<Welcome />
		{/if}
	</div>
</Section>
