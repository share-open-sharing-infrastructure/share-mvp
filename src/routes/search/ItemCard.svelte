<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { Badge, Card } from 'flowbite-svelte';
	import { MapPinOutline, MapPinSolid, MessagesSolid, PenNibSolid } from 'flowbite-svelte-icons';
	export let item: Item;
	export let imgUrl: string;
</script>

<div class="space-y-4">
	<Card img={imgUrl} horizontal size="xl">
		<div class="m-6 grow">
			<div class="flex justify-between items-center text-s font-thin mb-3">
				<p>
					von {item.expand?.owner?.username ?? 'Unknown'} 
					{#if item.trusteesOnly}
							<span class="text-green-900 bg-green-100">(vertraut dir)</span>
					{/if}
				</p>

				<span class="flex items-center gap-1">
					<MapPinOutline class="h-4 w-4" />
					{item.place}
				</span>
			</div>

			<h5
				class="mb-2 overflow-hidden text-2xl font-bold tracking-tight text-ellipsis text-gray-900 dark:text-white"
			>
				{item.name}
			</h5>
			<p class="mb-3 leading-tight font-normal text-gray-700">
				{item.description}
			</p>
			<div class="flex justify-between items-center text-xs font-thin mb-3">
				<p class="mb-3 text-xs leading-tight font-thin">
					{#if item.expand?.owner?.id}
						<a href="/chat/{item.expand.owner.id}" class="inline-flex items-center hover:underline">
							Kontaktieren
							<MessagesSolid class="ms-0.5 h-4 w-4" />
						</a>
					{/if}
				</p>

				
			</div>
			<div></div>
		</div>
	</Card>
</div>
