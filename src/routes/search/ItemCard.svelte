<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { Badge, Button, Card, Input } from 'flowbite-svelte';
	import { MapPinOutline, MessagesOutline } from 'flowbite-svelte-icons';
	import { Popover } from "flowbite-svelte";
	import { QuestionCircleSolid, ChevronRightOutline } from "flowbite-svelte-icons";
	export let item: Item;
	export let imgUrl: string;
	export let requesterId: string;
</script>





<div class="space-y-4">
	<Card img={imgUrl} horizontal size="xl">
		<div class="m-6 grow">
			<div class="flex justify-between items-center font-thin mb-3">
				<div class="flex">
					von {item.expand?.owner?.username ?? 'Unknown'}
					{#if item.trusteesOnly}
						<Badge rounded border color="green" class="ml-2">
							<span class="text-green-900 bg-green-100">vertraut dir</span>
						</Badge>
						<div class="flex items-center text-sm font-light text-gray-500 dark:text-gray-400">
							<button id="b3">
								<QuestionCircleSolid class="ml-1 h-full" />
								<span class="sr-only">Erkläre mir das</span>
							</button>
						</div>
					{/if}
				</div>

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
						<form
								class="inline-flex"
								method="POST"
								action="?/startConversation"
							>
								<Input name="itemId" value={item.id} hidden/>
								<Input name="requesterId" value={item.expand?.requester?.id} hidden/>
								<Input name="ownerId" value={item.expand?.owner?.id} hidden/>
								<Button pill class="
									cursor-pointer 
									min-button
									left-10 z-50
									" 
									type="submit">
									<MessagesOutline class="h-4 w-4 mr-2" /> Kontaktieren
								</Button>
							</form>
					</span>
				{/if}
			</div>
		</div>
	</Card>
</div>

<Popover triggeredBy="#b3" class="w-72 bg-white text-sm font-light text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400" placement="bottom-start">
  <div class="space-y-2 p-3">
    <h3 class="font-semibold text-gray-900 dark:text-white">Vertrauensfunktion</h3>
    Du siehst diesen Gegenstand nur, weil deren Besitzer:in dir vertraut. 
	Füge auch Du Kontakte hinzu, um liebgewonnene Dinge nur mit Vertrauten zu teilen.
    <a href="/social" class="text-primary-600 dark:text-primary-500 dark:hover:text-primary-600 hover:text-primary-700 flex items-center font-medium">
      Vertrauensfunktion <ChevronRightOutline class="text-primary-600 dark:text-primary-500 ms-1.5 h-4 w-4" />
    </a>
  </div>
</Popover>
