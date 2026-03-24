<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { Badge, Card } from 'flowbite-svelte';
	import { UserCircleOutline } from 'flowbite-svelte-icons';
	import { Popover } from 'flowbite-svelte';
	import {
		QuestionCircleSolid,
		ChevronRightOutline,
	} from 'flowbite-svelte-icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	interface Props {
		item: Item;
		imgUrl: string;
		profileView?: boolean;
	}
	let { item, imgUrl, profileView = false }: Props = $props();

</script>

<div class="space-y-4">
	<Card href="/items/{item.id}" img={imgUrl} classes={{ image: "h-48 w-48 object-cover shrink-0 md:h-48 mx-auto md:mx-0" }} horizontal size="xl">
		<div class="m-6 grow">
			{#if !profileView}
			<div class="flex justify-between items-center mb-3">
				<div class="flex">
					<button
					type="button"
					onclick={(e) => { 
						e.preventDefault(); // Prevent the default anchor behavior
						goto(resolve('/users/[id]', { id: item.expand?.owner?.id ?? '' })); 
						}} 
					class="text-primary-200 border-primary-200 rounded-full border hover:bg-primary-50 hover:cursor-pointer px-2"
				>
						<UserCircleOutline class="h-6 w-6 inline mr-1" />
						<span class="font-medium text-xs">{item.expand?.owner?.username ?? 'Unknown'}</span>
					</button>
					{#if item.trusteesOnly}
						<Badge rounded border color="green" class="ml-2 text-xs">
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
			</div>
			{/if}

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

{#if !profileView}
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
{/if}
