<script lang="ts">
	const { data, form } = $props();
	const { items, uniqueNames, uniquePlaces } = data;
	import { Section, TableHeader } from 'flowbite-svelte-blocks';
	import {
		Card,
		Img,
		Gallery,
		Button,
		Search,
		Dropdown,
		Checkbox,
		Modal,
		Label,
		Input,
		Fileupload,
		Helper,
		Alert
	} from 'flowbite-svelte';
	import { ChevronDownOutline } from 'flowbite-svelte-icons';
	import { selectedNames, selectedPlaces, searchTextState } from '../state.svelte';

	let formModal = $state(false);
	let error = $state(''); // TODO: Check if this is even used

	// helper for case insensitive search
	const includesCaseInsensitive = (str, searchString) => new RegExp(searchString, 'i').test(str);

	let filterList = $derived.by(() => {
		let filteredResults = [];
		filteredResults = items;
		/* TODO this currently only filters by one category, needs to be extended to multiple categories */
		if (selectedNames.selectedValues.length > 0) {
			filteredResults = filteredResults.filter((items) =>
				selectedNames.selectedValues.every((tag) => items.name.includes(tag))
			);
		}

		if (selectedPlaces.selectedValues.length > 0) {
			filteredResults = filteredResults.filter((items) =>
				selectedPlaces.selectedValues.every((tag) => items.place.includes(tag))
			);
		}

		if (searchTextState.value !== '') {
			filteredResults = filteredResults.filter((items) =>
				includesCaseInsensitive(items.name, searchTextState.value)
			);
		}

		// Filter out own items
		filteredResults = filteredResults.filter((item) => item.expand.field.id !== data.userId);

		// console.log(filteredResults);
		return filteredResults;
	});
</script>


<Section>
	
	<div class="flex items-center justify-center">
		<span class="text-2xl font-semibold text-gray-900 dark:text-white"> Gegenstände </span>
	</div>
	<div class="flex items-center justify-center">
		<h5>{filterList.length} Gegenstände gefunden</h5>
	</div>
	
	<Section
		name="tableheader"
		sectionClass="dark:bg-gray-900 flex pt-8 mx-auto max-w-6xl dark:hover:bg-gray-700"
	>
		<TableHeader headerType="search">
			{#snippet search()}
				<Search
					size="md"
					class="mr-4 flex flex-col"
					classes={{ input: 'focus:ring-gray-700 focus:border-gray-700' }}
					placeholder="Suche Gegenstände..."
					bind:value={searchTextState.value}
				/>
			{/snippet}
			<Button
				class="bg-gray-800 text-white hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
				onclick={() => (formModal = true)}
			>
				Gegenstand hinzufügen
			</Button>
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
				<!-- TODO: How does this button open the dropdown? Is this just achieved by the Chevron? -->
			</Button>

			<Dropdown simple class="w-48 p-2 text-sm">
				<h6 class="mb-1 ml-1 text-sm font-medium text-gray-900 dark:text-white">Ort</h6>
				{#each uniquePlaces as place}
					<li class="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-600">
						<Checkbox
							checked
							inline
							class="text-gray-900 focus:ring-gray-700"
							bind:group={selectedPlaces.selectedValues}
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
							bind:group={selectedNames.selectedValues}
							value={name}>{name}</Checkbox
						>
					</li>
				{/each}
			</Dropdown>
		</TableHeader>
	</Section>

	<div class="mx-auto max-w-6xl space-y-4 overflow-x-auto p-4 md:space-y-6">
		{#if form?.fail}
			<div class="variant-soft-error rounded-token mb-2 px-4 py-2">
				<Alert>
					<span class="font-medium">
						{form.message}
					</span>
				</Alert>
			</div>
		{/if}
		<Gallery class="grid-cols-1 gap-4 md:grid-cols-4">
			{#each filterList as item}
				<Card>
					<div class="m-6">
						<Img
							src={`${data.PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}`}
							alt="item image"
							class="mx-auto h-48 w-full rounded-md object-cover p-5"
						/>

						<h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
							{item.name}
						</h5>
						<p class="mt-2 mb-2 text-xs leading-tight font-thin text-gray-400 dark:text-gray-400">
							{item.place}
						</p>
						<p class="mb-3 text-base leading-normal font-normal text-gray-700 dark:text-gray-400">
							{item.description}
						</p>
						<div class="flex space-x-10 sm:mt-0">
							<p class="mb-3 text-xs leading-tight font-thin text-gray-400 dark:text-gray-400">
								Hinzugefügt am: {new Date(item.created).toLocaleDateString('de-DE', {
									day: '2-digit',
									month: '2-digit',
									year: '2-digit'
								})}
							</p>
						</div>
						<div>
							<!-- TODO: Once the database relation is renamed from field to "owner" or sth, rename -->
							<p class="mb-3 text-xs leading-tight font-thin text-gray-400 dark:text-gray-400">
								von {item.expand.field.username}
								<a href="/chat/{item.expand.field.id}">
									(kontaktieren)
								</a>
							</p>
						</div>
					</div>
				</Card>
			{/each}
		</Gallery>
	</div>
</Section>

<Modal bind:open={formModal} size="xs">
	<form
		class="flex flex-col space-y-6"
		action="?/create"
		method="post"
		enctype="multipart/form-data"
	>
		<h3 class="mb-4 text-xl font-medium text-gray-900 dark:text-white">Details</h3>
		{#if error}
			<Label color="red">{error}</Label>
		{/if}
		<Label class="space-y-2">
			<span>Bild hochladen</span>
			<Fileupload type="file" id="with_helper" name="image" class="mb-2" required/>
			<Helper>SVG, PNG, JPG or GIF (max. 800x400px).</Helper>
		</Label>
		<Label class="space-y-2">
			<span>Name</span>
			<Input type="text" name="name" placeholder="Name des Gegenstands" required />
		</Label>
		<Label class="space-y-2">
			<span>Beschreibung</span>
			<Input type="text" name="description" placeholder="Beschreibung des Gegenstands" required />
		</Label>
		<Label class="space-y-2">
			<span>Ort</span>
			<Input type="text" name="place" placeholder="Ort des Gegenstands" required />
		</Label>
		<Button
			class="bg-gray-800 text-white hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
			type="submit">Gegenstand hinzufügen</Button
		>
	</form>
</Modal>
