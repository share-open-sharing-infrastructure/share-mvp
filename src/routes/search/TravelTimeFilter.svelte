<script lang="ts">
	import { Dropdown, DropdownItem } from 'flowbite-svelte';
	import { ChevronDownOutline } from 'flowbite-svelte-icons';
	import { onMount, untrack } from 'svelte';
	import { texts } from '$lib/texts';
	import TransportModeIcon from '$lib/components/TransportModeIcon.svelte';
	import AllerLoader from '$lib/components/AllerLoader.svelte';
	import type { ItemPublic } from '$lib/types/models';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	interface Props {
		preferredMode: TransportMode | undefined;
		isLoggedIn: boolean;
		hasQuery: boolean;
		items: ItemPublic[];
		transportMode: TransportMode | null;
		travelTimes: Record<string, number>;
		maxMinutes: number;
	}

	let {
		preferredMode,
		isLoggedIn,
		hasQuery,
		items,
		transportMode = $bindable(),
		travelTimes = $bindable(),
		maxMinutes = $bindable(),
	}: Props = $props();

	let dropdownOpen = $state(false);
	let showNoLocationPrompt = $state(false);
	let locationStatus = $state<'idle' | 'requesting' | 'denied'>('idle');
	let isFetchingTravelTimes = $state(false);
	let cachedUserLocation: { lon: number; lat: number } | null = null;
	let mounted = false;

	// Fire-and-forget: sends a diagnostic event to the server log. Never throws.
	function sendDiag(payload: Record<string, unknown>) {
		fetch('/api/diagnostics', { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});
	}

	async function fetchTravelTimes(mode: TransportMode, userLocation: { lon: number; lat: number }) {
		isFetchingTravelTimes = true;

		const ownerIds = [...new Set(items.map((item) => item.userId).filter(Boolean))];
		if (ownerIds.length === 0) {
			isFetchingTravelTimes = false;
			return;
		}

		// Abort after 15s so a hanging ORS response doesn't leave the UI stuck indefinitely
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 15_000);
		try {
			const response = await fetch('/api/travel-times/search', {
				method: 'POST',
				signal: controller.signal,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userLocation, transportMode: mode, ownerIds }),
			});
			
			if (response.ok) {
				travelTimes = await response.json();
			} else {
				sendDiag({ event: 'fetch_error', page: 'search', status: response.status });
			}
		} catch (err) {
			// AbortError means our 15s timeout fired; any other error is a network failure
			const isTimeout = err instanceof DOMException && err.name === 'AbortError';
			sendDiag({ event: isTimeout ? 'fetch_timeout' : 'fetch_error', page: 'search' });
		} finally {
			clearTimeout(timeoutId);
			isFetchingTravelTimes = false;
		}
	}

	function requestLocation(mode: TransportMode, { onDenied }: { onDenied?: () => void } = {}) {
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				if (!mounted) { return; }
				cachedUserLocation = { lon: pos.coords.longitude, lat: pos.coords.latitude };
				fetchTravelTimes(mode, cachedUserLocation);
				showNoLocationPrompt = false;
				locationStatus = 'idle';
			},
			(err) => {
				if (!mounted) return;
				isFetchingTravelTimes = false;
				onDenied?.();
			}
		);
	}

	function activateLocation() {
		locationStatus = 'requesting';
		requestLocation(transportMode!, {
			onDenied: () => {
				locationStatus = 'denied';
			},
		});
	}

	function handleTransportModeChange(mode: TransportMode) {
		transportMode = mode;
		dropdownOpen = false;
		showNoLocationPrompt = false;

		if (isLoggedIn) {
			const fd = new FormData();
			fd.append('mode', mode);
			fetch('?/saveTransportMode', { method: 'POST', body: fd }).catch((err) =>
				console.error('Failed to save transport mode:', err)
			);
		}

		if (cachedUserLocation) {
			fetchTravelTimes(mode, cachedUserLocation);
			return;
		}

		requestLocation(mode, {
			onDenied: () => {
				showNoLocationPrompt = true;
			},
		});
	}

	$effect(() => {
		if (items.length === 0) { return; }
		// tracks items as a reactive dependency; re-fetches when items change
		untrack(() => {
			if (!mounted) {  return; }
			if (!transportMode) { return; }
			if (!cachedUserLocation) { return; }
			fetchTravelTimes(transportMode, cachedUserLocation);
		});
	});

	onMount(() => {
		mounted = true;
		return () => {
			mounted = false;
		};
	});
</script>



{#if isLoggedIn && hasQuery}
<div
		class="flex flex-wrap justify-center items-center border border-primary-100 dark:border-tinte-700 rounded-xl px-3 py-1"
	>
		<!-- Loading spinner while ORS fetch is in flight -->
		{#if isFetchingTravelTimes}
			<AllerLoader size={22} speed={1.2} variant="rotate" label="Reisezeiten werden berechnet …" />
		{/if}
		<!-- Transport mode selector -->
		<div class="relative ml-2">
			{#if transportMode === null && preferredMode}
				<!-- Preferred mode known: single click triggers calculation directly -->
				<button
					type="button"
					onclick={() => handleTransportModeChange(preferredMode)}
					class="flex items-center text-sm font-medium text-tinte-700 dark:text-tinte-200 bg-white dark:bg-tinte-700 border border-tinte-300 dark:border-tinte-600 rounded-full px-3 py-1 hover:bg-tinte-50 dark:hover:bg-tinte-600 cursor-pointer transition-colors"
				>
					{texts.pages.itemDetail.calculateTravelTime}
				</button>
			{:else}
				<!-- No preferred mode, or mode already selected: use dropdown -->
				<button
					id="search-transport-btn"
					type="button"
					class="flex items-center text-sm font-medium text-tinte-700 dark:text-tinte-200 bg-white dark:bg-tinte-700 border border-tinte-300 dark:border-tinte-600 rounded-full px-3 py-1 hover:bg-tinte-50 dark:hover:bg-tinte-600 cursor-pointer transition-colors"
				>
					{#if transportMode === null}
						{texts.pages.itemDetail.calculateTravelTime}
					{:else}
						<TransportModeIcon mode={transportMode} class="h-3.5 w-3.5 mr-1" />
						{texts.pages.search.transportModes[transportMode]}
					{/if}
					<ChevronDownOutline class="h-3 w-3 ml-0.5" />
				</button>
				<Dropdown
					bind:isOpen={dropdownOpen}
					triggeredBy="#search-transport-btn"
					placement="bottom-start"
				>
					{#each ['foot', 'bicycle', 'car'] as const as m (m)}
						<DropdownItem
							onclick={() => handleTransportModeChange(m)}
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
			{/if}
		</div>

		<!-- Travel time slider (only once a mode is chosen) -->
		{#if transportMode !== null}
			<div class="flex items-center gap-2 ml-1">
				<input
					type="range"
					min="5"
					max="30"
					step="5"
					bind:value={maxMinutes}
					class="w-full h-2 accent-primary cursor-pointer"
				/>
				<span class="text-sm text-tinte-600 dark:text-tinte-300 w-28">
					{maxMinutes >= 30
						? texts.pages.search.durationFilter.noLimit
						: texts.pages.search.durationFilter.maxMinutes(maxMinutes)}
				</span>
			</div>
		{/if}
	</div>

	<!-- Location permission prompt -->
	{#if showNoLocationPrompt}
		<div class="flex flex-col items-center gap-1.5 mt-2 text-center">
			{#if locationStatus === 'denied'}
				<p class="text-sm text-tinte-500">
					{texts.onboarding.browserLocation.denied}
				</p>
			{:else}
				<p class="text-sm text-tinte-500">
					{texts.onboarding.browserLocation.explanation}
				</p>
				<button
					type="button"
					onclick={activateLocation}
					disabled={locationStatus === 'requesting'}
					class="text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-full px-3 py-1 hover:bg-primary-100 disabled:opacity-50 transition-colors"
				>
					{locationStatus === 'requesting' ? '…' : texts.onboarding.browserLocation.allow}
				</button>
			{/if}
		</div>
	{/if}
{/if}
