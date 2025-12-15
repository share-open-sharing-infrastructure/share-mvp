<script>
	import { Button, Checkbox, Dropdown, Search } from "flowbite-svelte";
	import { Section, TableHeader } from "flowbite-svelte-blocks";
	import { ChevronDownOutline } from "flowbite-svelte-icons";

    let { searchText, isSearching, selectedPlaces, uniquePlaces } = $props();

</script>
<Section
    name="tableheader"
    sectionClass="dark:bg-gray-900 flex pt-8 mx-auto max-w-5xl dark:hover:bg-gray-700"
>
    <TableHeader headerType="search">
        {#snippet search()}
            <Search
                size="md"
                class="mr-4 flex flex-col"
                classes={{ input: 'focus:ring-primary-700 focus:border-primary-700' }}
                placeholder="Suche Dinge..."
                bind:value={searchText.value}
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
            </Dropdown>
        {/if}
    </TableHeader>
</Section>