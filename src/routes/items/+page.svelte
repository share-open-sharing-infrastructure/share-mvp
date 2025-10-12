<script lang="ts">
	export let data;
	const { items } = data;
	import { Card, Img, Gallery } from 'flowbite-svelte';
	import { Section } from 'flowbite-svelte-blocks';
</script>

<Section>
	<div class="flex items-center justify-center">
		<a href="/" class="text-2xl font-semibold text-gray-900 dark:text-white"> Gegenstände </a>
	</div>
	<div class="mx-auto max-w-6xl space-y-4 overflow-x-auto p-6 sm:p-8 md:space-y-6">
		<Gallery class="grid-cols-1 gap-4 md:grid-cols-4">
			{#each items as item}
				<Card>
					<Img
						src={`${data.PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}`}
						alt="item image"
						class="mx-auto h-48 w-full rounded-md object-cover p-5"
					/>
					<div class="m-6">
						<h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
							{item.name}
						</h5>
						<p class="mb-3 text-base leading-normal font-normal text-gray-700 dark:text-gray-400">
							{item.description}
						</p>
						<p class="mb-3 text-xs leading-tight font-thin text-gray-400 dark:text-gray-400">
							Hinzugefügt am: {new Date(item.created).toLocaleDateString('de-DE', {day: '2-digit',month: '2-digit', year: '2-digit'})}
						</p>
						<p class="mb-3 text-xs font-thin text-gray-400 dark:text-gray-400">
							Aktualisiert am: {new Date(item.updated).toLocaleDateString('de-DE', {day: '2-digit',month: '2-digit', year: '2-digit'})}
						</p>
					</div>
				</Card>
			{/each}
		</Gallery>
	</div>
</Section>
