<script>
	import { Search } from 'flowbite-svelte';
	import { Section, TableHeader } from 'flowbite-svelte-blocks';
	import { texts } from '$lib/texts';

	let { searchText, isSearching } = $props();
</script>




	<TableHeader headerType="search" class="w-full p-0">
		{#snippet search()}
			<Search
				size="md"
				class="flex flex-col p-0"
				classes={{
					input: 'focus:ring-primary focus:border-primary search-bar pulse-shadow w-full',
				}}
				placeholder={texts.forms.searchPlaceholder}
				bind:value={searchText.value}
			/>
		{/snippet}

		{#if isSearching}
			<!-- FILTER DISABLED WHILE FUNCTION NOT IN USE  -->
			<!-- <Button color="light" style="border-radius:20px; cursor:pointer;">
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
				<h6 class="mb-1 ml-1 text-sm font-medium text-gray-900 dark:text-white">
					{texts.forms.place}
				</h6>
				{#each uniquePlaces as place (place)}
					<li class="rounded p-1 hover:bg-primary-50 dark:hover:bg-primary-900">
						<Checkbox
							checked
							inline
							class="text-gray-900 focus:ring-primary-700"
							bind:group={selectedPlaces}
							value={place}>{place}</Checkbox
						>
					</li>
				{/each}
			</Dropdown> -->
		{/if}
	</TableHeader>