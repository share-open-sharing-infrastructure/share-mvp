<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { Badge, Button, Card } from 'flowbite-svelte';
	import { MapPinOutline, MessagesOutline } from 'flowbite-svelte-icons';
	export let item: Item;
	export let imgUrl: string;
</script>

<div class="space-y-4">
	<Card img={imgUrl} horizontal size="xl">
		<div class="m-6 grow">
			<div class="flex justify-between items-center font-thin mb-3">
				<p>
					von {item.expand?.owner?.username ?? 'Unknown'}
					{#if item.trusteesOnly}
					 <Badge rounded border color="green" class="ml-2">
						<span class="text-green-900 bg-green-100">vertraut dir</span>
					</Badge>
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
				{#if item.expand?.owner?.id}
					<span class="ml-auto">
						<a href="/chat/{item.expand.owner.id}" class="flex items-center gap-2">
							<Button
								pill
								onclick={() => {}}
								class="
									min-button
									left-10 z-50
									cursor-pointer
								"
							>
								<MessagesOutline class="h-4 w-4 mr-2" /> Kontaktieren
							</Button>
						</a>
					</span>
				{/if}
			</div>
		</div>
	</Card>
</div>
