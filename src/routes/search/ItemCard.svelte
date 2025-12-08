<script lang="ts">
	import type { Item } from '$lib/types';
	import { Card, Img } from 'flowbite-svelte';
	import { PenNibSolid } from 'flowbite-svelte-icons';
	export let item: Item;
	export let imgUrl: string;
</script>

<div class="space-y-4">
	<Card img={imgUrl} horizontal size="xl" class="">
		<div class="m-6">
			<div class="flex space-x-10 sm:mt-0">
				<p class="mb-3 text-xs leading-tight font-thin">
					Hinzugefügt am: {new Date(item.created).toLocaleDateString('de-DE', {
						day: '2-digit',
						month: '2-digit',
						year: '2-digit'
					})}
				</p>
			</div>
			<h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
				{item.name}
			</h5>
			<p class="mb-3 leading-tight font-normal text-gray-700">
				{item.description}
			</p>
			<p class="mt-2 mb-2 text-xs leading-tight font-thin">
				{item.place}
			</p>
			<div>
				<!-- TODO: Once the database relation is renamed from field to "owner" or sth, rename -->
				<p class="mb-3 text-xs leading-tight font-thin">
					von {item.expand?.field?.username ?? 'Unknown'}
                    
					{#if item.expand?.field?.id}
						<a href="/chat/{item.expand.field.id}" class="inline-flex items-center text-primary-600 hover:underline">
							Anschreiben
							<PenNibSolid class="ms-0.5 h-4 w-4" />
						</a>
					
					{/if}
                    
				</p>
			</div>
		</div>
	</Card>
</div>
