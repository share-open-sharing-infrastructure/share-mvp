<script lang="ts">
	import { Dropdown, DropdownItem } from 'flowbite-svelte';
	import { ChevronDownOutline } from 'flowbite-svelte-icons';
	import { untrack } from 'svelte';
	import { texts } from '$lib/texts';
	import TransportModeIcon from '$lib/components/TransportModeIcon.svelte';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	interface Props {
		itemId: string;
		preferredTransportMode: TransportMode;
	}

	const { itemId, preferredTransportMode }: Props = $props();

	let transportMode = $state<TransportMode>(
		untrack(() => preferredTransportMode ?? 'bicycle')
	);
	let travelMinutes = $state<number | null | undefined>(undefined);
	let dropdownOpen = $state(false);
	let calculating = $state(false);
	let cachedUserLocation: { lon: number; lat: number } | null = null;

	async function fetchTravelTime(mode: TransportMode, userLocation: { lon: number; lat: number }) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 15_000);
		try {
			const res = await fetch('/api/travel-times/item', {
				method: 'POST',
				signal: controller.signal,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ itemId, userLocation, transportMode: mode }),
			});
			if (res.ok) {
				const { minutes } = await res.json();
				travelMinutes = minutes ?? null;
			} else {
				fetch('/api/diagnostics', { method: 'POST', body: JSON.stringify({ event: 'fetch_error', page: 'item_detail', status: res.status }) }).catch(() => {});
			}
		} catch (err) {
			const isTimeout = err instanceof DOMException && err.name === 'AbortError';
			fetch('/api/diagnostics', { method: 'POST', body: JSON.stringify({ event: isTimeout ? 'fetch_timeout' : 'fetch_error', page: 'item_detail' }) }).catch(() => {});
		} finally {
			clearTimeout(timeoutId);
			calculating = false;
		}
	}

	function requestAndFetch(mode: TransportMode) {
		calculating = true;
		if (cachedUserLocation) {
			fetchTravelTime(mode, cachedUserLocation);
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				cachedUserLocation = { lon: pos.coords.longitude, lat: pos.coords.latitude };
				fetchTravelTime(mode, cachedUserLocation);
			},
			() => {
				calculating = false;
			}
		);
	}

	function handleModeChange(mode: TransportMode) {
		transportMode = mode;
		dropdownOpen = false;
		travelMinutes = undefined;
		requestAndFetch(mode);
	}
</script>

{#if calculating}
	<span class="text-sm text-gray-400 dark:text-gray-500 animate-pulse px-2 py-0.5">
		{texts.pages.itemDetail.calculateTravelTime}…
	</span>
{:else if travelMinutes === undefined}
	<button
		type="button"
		onclick={() => requestAndFetch(transportMode)}
		class="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2 cursor-pointer"
	>
		{texts.pages.itemDetail.calculateTravelTime}
	</button>
{:else if travelMinutes !== null}
	<div class="relative">
		<button
			id="item-transport-btn"
			type="button"
			class="flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
		>
			<TransportModeIcon mode={transportMode} class="h-3.5 w-3.5" />
			{texts.pages.search.minutesAway(travelMinutes)}
			<ChevronDownOutline class="h-3 w-3 ml-0.5" />
		</button>
		<Dropdown bind:isOpen={dropdownOpen} triggeredBy="#item-transport-btn" placement="bottom-end">
			{#each (['foot', 'bicycle', 'car'] as const) as m (m)}
				<DropdownItem
					onclick={() => handleModeChange(m)}
					classes={{ li: 'list-none' }}
					class={transportMode === m ? 'font-semibold text-primary' : ''}
				>
					<span class="flex items-center gap-2">
						<TransportModeIcon mode={m} class="h-4 w-4" />
						{texts.pages.search.transportModes[m]}
					</span>
				</DropdownItem>
			{/each}
		</Dropdown>
	</div>
{/if}
