<script>
	import { Card, Gallery, Img } from 'flowbite-svelte';
	import { Section } from 'flowbite-svelte-blocks';

    let { data } = $props();
</script>




<!-- User meta data -->

<!-- Friend list? -->

<!-- User's items (although maybe that should be its own page) -->
<Section>
	<div class="flex items-center justify-center">
		<a href="/" class="text-2xl font-semibold text-gray-900 dark:text-white">Deine Gegenstände </a>
	</div>

	<div class="mx-auto max-w-6xl space-y-4 overflow-x-auto p-4 md:space-y-6">
		<Gallery class="grid-cols-1 gap-4 md:grid-cols-4">
			{#each data.user.expand.items_via_field as item}
				<Card>
					<div class="m-6">
						<Img
							src={`${data.PB_URL}api/files/${item.collectionId}/${item.id}/${item.image}`}
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
					</div>
				</Card>
			{/each}
		</Gallery>
	</div>
</Section>

<div>
    Du verleihst:
    <ul>
        {#each data.user.expand.items_via_field as item}
            <li>{item.name}</li>
        {/each}
    </ul>
</div>