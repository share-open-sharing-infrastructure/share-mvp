<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { Badge, Card } from 'flowbite-svelte';
	import { MapPinOutline, UserCircleOutline } from 'flowbite-svelte-icons';
	import { Popover } from 'flowbite-svelte';
	import {
		QuestionCircleSolid,
		ChevronRightOutline,
	} from 'flowbite-svelte-icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	interface Props {
		item: Item;
		imgUrl: string;
		profileView?: boolean;
		/** Travel time in minutes. undefined = not yet fetched, null = owner has no location */
		travelMinutes?: number | null;
		transportMode?: TransportMode;
	}
	let { item, imgUrl, profileView = false, travelMinutes, transportMode = 'bicycle' }: Props = $props();
</script>

<div class="space-y-4">
	<Card href="/items/{item.id}" img={imgUrl} classes={{ image: "h-48 w-48 object-cover shrink-0 md:h-48 mx-auto md:mx-0" }} horizontal size="xl">
		<div class="m-6 grow">
			{#if !profileView}
			<div class="flex justify-between items-center mb-3 ">
				<div class="flex">
					<!-- Owner button -->
					<button
					type="button"
					onclick={(e) => {
						e.preventDefault(); // Prevent the default anchor behavior
						goto(resolve('/users/[id]', { id: item.expand?.owner?.id ?? '' }));
						}}
					class="text-primary-200 border-primary-200 rounded-full border hover:bg-primary-50 hover:cursor-pointer px-1"
				>
						<UserCircleOutline class="h-6 w-6 inline " />
						<span class="font-medium text-xs">{item.expand?.owner?.username ?? 'Unknown'}</span>
					</button>

					<!-- Trust badge -->
					{#if item.trusteesOnly}
						<Badge id="b3" rounded border color="green" class="ml-2">
							<span class="text-green-900 bg-green-100 truncate">vertraut dir</span>
						</Badge>
						<!-- <div
							class="flex items-center text-xs font-light text-gray-500 dark:text-gray-400"
						>
							<button id="b3">
								<QuestionCircleSolid class="ml-1 h-full" />
								<span class="sr-only">{texts.ui.explainThis}</span>
							</button>
						</div> -->
					{/if}
				</div>

				<div class="flex items-center gap-2">
					<!-- Travel time badge -->
					{#if travelMinutes !== undefined}
						<span class="flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
							{#if transportMode === 'foot'}
								<!-- Walking icon -->
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
									<path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/>
								</svg>
							{:else if transportMode === 'bicycle'}
								<!-- Bicycle icon -->
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
									<path d="M15.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM5 12.5a4.5 4.5 0 1 0 9 0 4.5 4.5 0 0 0-9 0zm2 0a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm8-4.5-3.5-4H8v2h2.8l2.1 2.5-4.4 3.5H4v2h5l3.6-2.9 1.8 2.1-.5 3.3H16v-4.2l-1-1.3zM19 8a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/>
								</svg>
							{:else}
								<!-- Car icon -->
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
									<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
								</svg>
							{/if}
							{#if travelMinutes === null}
								?
							{:else}
								{texts.pages.search.minutesAway(travelMinutes)}
							{/if}
						</span>
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
