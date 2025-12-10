<script lang="ts">
	const { data } = $props();
	const { items, uniqueNames, uniquePlaces } = data;
	import { Section, TableHeader } from 'flowbite-svelte-blocks';
	import { Gallery, Button, Search, Dropdown, Checkbox } from 'flowbite-svelte';
	import { ChevronDownOutline } from 'flowbite-svelte-icons';
	import ItemCard from './ItemCard.svelte';
	import type { Item } from '$lib/types/models';

	let selectedNames: string[] = $state([]);
	let selectedPlaces: string[] = $state([]);
	let searchText = $state('');

	// Helper for case insensitive search
	const includesCaseInsensitive = (str: string, searchString: string) =>
		str.toLowerCase().includes(searchString.toLowerCase());

	let isSearching: boolean = $derived(searchText.length > 0);

	// Filters result set item list based on selected filters and search text
	let filteredItemList: Item[] = $derived(
		items.filter((item: Item) => {
			// Filter by selected names
			if (selectedNames.length > 0 && !selectedNames.includes(item.name)) {
				return false;
			}

			// Filter by selected places
			if (selectedPlaces.length > 0 && !selectedPlaces.includes(item.place)) {
				return false;
			}

			// Filter by search text
			if (searchText.length && !includesCaseInsensitive(item.name, searchText)) {
				return false;
			}

			return true;
		})
	);
</script>

<Section>
	<div class="flex items-center justify-center">
		<span class="text-2xl font-semibold text-gray-900 dark:text-white">
			AllerLeih Dinge zum Teilen!
		</span>
	</div>

	<Section
		name="tableheader"
		sectionClass="dark:bg-gray-900 flex pt-8 mx-auto max-w-5xl dark:hover:bg-gray-700"
	>
		<TableHeader headerType="search">
			{#snippet search()}
				<Search
					size="md"
					class="mr-4 flex flex-col"
					classes={{ input: 'focus:ring-gray-700 focus:border-gray-700' }}
					placeholder="Suche Dinge..."
					bind:value={searchText}
				/>
			{/snippet}

			{#if isSearching}
				<Button color="light">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
						class="mr-2 h-4 w-4 text-gray-400"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
							clip-rule="evenodd"
						/>
					</svg>
					Filter<ChevronDownOutline />
				</Button>

				<Dropdown simple class="w-48 p-2 text-sm">
					<h6 class="mb-1 ml-1 text-sm font-medium text-gray-900 dark:text-white">Ort</h6>
					{#each uniquePlaces as place}
						<li class="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-600">
							<Checkbox
								checked
								inline
								class="text-gray-900 focus:ring-gray-700"
								bind:group={selectedPlaces}
								value={place}>{place}</Checkbox
							>
						</li>
					{/each}
					<h6 class="mt-5 mb-1 ml-1 text-sm font-medium text-gray-900 dark:text-white">Name</h6>
					{#each uniqueNames as name}
						<li class="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-600">
							<Checkbox
								checked
								inline
								class="text-gray-900 focus:ring-gray-700"
								bind:group={selectedNames}
								value={name}>{name}</Checkbox
							>
						</li>
					{/each}
				</Dropdown>
			{/if}
		</TableHeader>
	</Section>

	<div class="mx-auto max-w-5xl space-y-4 overflow-x-auto p-4 md:space-y-6">
		{#if isSearching}
			<div class="flex items-center justify-center pt-2">
				<h5>{filteredItemList.length} Dinge gefunden</h5>
			</div>
			<Gallery
				class="mx-auto max-w-5xl grid-cols-1 gap-4 pt-2 max-md:grid-cols-2 max-sm:grid-cols-3 md:grid-cols-1"
			>
				{#each filteredItemList as item}
					<ItemCard
						{item}
						imgUrl={`${data.PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}`}
					/>
				{/each}
			</Gallery>
		{:else}
			<div
				class="
				mx-auto
				mt-10 flex max-w-md flex-col
				items-center justify-center gap-4
				text-center text-lg text-gray-600 dark:text-white
				"
			>
				<p>Bei AllerLeih findest du allerlei Dinge aus deiner Umgebung</p>
				<p>zum leihen, teilen, mieten, ...</p>
				<p>Nutze einfach die Suche oben oder</p>
				<Button
					class="me-2 mb-2 w-full rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
					href="/profile">biete selbst etwas an!</Button
				>
				<p>von und für Freunde, Familie und die lokale Gemeinschaft</p>
			</div>
		{/if}
	</div>
</Section>
