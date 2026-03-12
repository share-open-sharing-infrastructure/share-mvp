<script lang="ts">
	import { Section } from 'flowbite-svelte-blocks';
	import type { Item } from '$lib/types/models';
	import SearchBar from './SearchBar.svelte';
	import Welcome from './Welcome.svelte';
	import ResultsList from './ResultsList.svelte';
	import HowToButton from './HowToButton.svelte';

	const { data } = $props();
	// svelte-ignore state_referenced_locally
	const { items } = data;

	let selectedPlaces: string[] = $state([]);
	let searchText = $state({ value: '' });

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
			if (
				searchText.value.length &&
				!includesCaseInsensitive(item.name, searchText.value)
			) {
				return false;
			}

			return true;
		})
	);
</script>

<Section class="max-w-5xl mx-auto">
	<SearchBar {searchText} {isSearching} />

	<ResultsList
		{filteredItemList}
		PB_IMG_URL={data.PB_IMG_URL}
		requesterId={data.currentUser?.userId}
	/>


</Section>

<HowToButton />
