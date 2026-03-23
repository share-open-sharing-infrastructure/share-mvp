<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { Badge, Card } from 'flowbite-svelte';
	import { MapPinOutline, UserCircleOutline } from 'flowbite-svelte-icons';
	import { Popover } from 'flowbite-svelte';
	import {
		QuestionCircleSolid,
		ChevronRightOutline,
	} from 'flowbite-svelte-icons';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	export let item: Item;
	export let imgUrl: string;
</script>

<div class="space-y-4">
	<Card href="/items/{item.id}" img={imgUrl} imgClass="h-48 w-48 object-cover shrink-0 md:h-48 mx-auto md:mx-0" horizontal size="xl">
		<div class="m-6 grow">
			<div class="flex justify-between items-center mb-3">
				<div class="flex">
					<div class="text-primary-200 border-primary-200 rounded-full border hover:bg-primary-50 hover:cursor-pointer px-2 py-1">
						<UserCircleOutline class="h-6 w-6 inline mr-1" />
						<span class="font-medium">{item.expand?.owner?.username ?? 'Unknown'}</span>
					</div>
					{#if item.trusteesOnly}
						<Badge rounded border color="green" class="ml-2">
							<span class="text-green-900 bg-green-100">vertraut dir</span>
						</Badge>
						<div
							class="flex items-center text-sm font-light text-gray-500 dark:text-gray-400"
						>
							<button id="b3">
								<QuestionCircleSolid class="ml-1 h-full" />
								<span class="sr-only">{texts.ui.explainThis}</span>
							</button>
						</div>
					{/if}
				</div>

				<span class="flex items-center gap-1 text-accent font-medium">
					<MapPinOutline class="h-4 w-4" />
					{item.expand?.owner?.city ?? ''}
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
			</div>
	</Card>
</div>

<Popover
	triggeredBy="#b3"
	class="w-72 bg-white text-sm font-light text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
	placement="bottom-start"
>
	<div class="space-y-2 p-3">
		<h3 class="font-semibold text-gray-900 dark:text-white">
			{texts.ui.trustFunction}
		</h3>
		{texts.ui.trustDescription}
		<a
			href={resolve('/social')}
			class="text-accent hover:underline flex items-center font-medium mt-1"
		>
			{texts.ui.trustFunction}
			<ChevronRightOutline class="text-accent  ms-1.5 h-4 w-4" />
		</a>
	</div>
</Popover>
