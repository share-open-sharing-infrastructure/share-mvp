<script lang="ts">
	import { Dropdown, DropdownItem } from 'flowbite-svelte';
	import { ChevronDownOutline } from 'flowbite-svelte-icons';
	import { tick, untrack } from 'svelte';
	import { texts } from '$lib/texts';
	import TransportModeIcon from '$lib/components/TransportModeIcon.svelte';
	import AllerLoader from '$lib/components/AllerLoader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		getPosition,
		isPermissionBlocked,
		queryGeoPermission,
		supportsPermissionsQuery,
	} from '$lib/utils/geolocation';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	interface Props {
		itemId: string;
		preferredTransportMode: TransportMode;
	}

	const { itemId, preferredTransportMode }: Props = $props();

	let transportMode = $state<TransportMode>(
		untrack(() => preferredTransportMode || 'bicycle')
	);
	let travelMinutes = $state<number | null | undefined>(undefined);
	let dropdownOpen = $state(false);
	let calculating = $state(false);
	let locationBlocked = $state(false);
	let cachedUserLocation: { lon: number; lat: number } | null = null;
	// Focus target for the blocked-guidance message so it's reachable after the
	// clicked control it replaces is removed from the DOM (see focusBlockedMessage).
	let blockedMessageEl: HTMLParagraphElement | null = $state(null);

	// Fire-and-forget: sends a diagnostic event to the server log. Never throws.
	function sendDiag(payload: Record<string, unknown>) {
		fetch('/api/diagnostics', { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});
	}

	async function fetchTravelTime(mode: TransportMode, userLocation: { lon: number; lat: number }) {
		// Abort after 15s so a hanging ORS response doesn't leave `calculating` stuck as true indefinitely
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
				sendDiag({ event: 'fetch_error', page: 'item_detail', status: res.status });
			}
		} catch (err) {
			// AbortError means our 15s timeout fired; any other error is a network failure
			const isTimeout = err instanceof DOMException && err.name === 'AbortError';
			sendDiag({ event: isTimeout ? 'fetch_timeout' : 'fetch_error', page: 'item_detail' });
		} finally {
			clearTimeout(timeoutId);
			calculating = false;
		}
	}

	/** Requests the user's location for `mode`, routed through the shared geolocation
	 *  helper. Where the Permissions API is available we check it first so a hard
	 *  denial goes straight to the blocked UI instead of a futile `getCurrentPosition()`
	 *  call. Where it isn't (iOS Safari never implements it for geolocation) we call
	 *  `getPosition()` directly — awaiting the permission query first would break the
	 *  click handler's user-gesture chain and silently suppress the native prompt. */
	async function requestAndFetch(mode: TransportMode) {
		locationBlocked = false;

		if (cachedUserLocation) {
			calculating = true;
			fetchTravelTime(mode, cachedUserLocation);
			return;
		}

		if (supportsPermissionsQuery()) {
			const permission = await queryGeoPermission();
			if (isPermissionBlocked(permission)) {
				locationBlocked = true;
				await focusBlockedMessage();
				return;
			}
		}

		calculating = true;
		try {
			cachedUserLocation = await getPosition();
			fetchTravelTime(mode, cachedUserLocation);
		} catch {
			calculating = false;
			locationBlocked = true;
			await focusBlockedMessage();
		}
	}

	// The button the user clicked is unmounted once the blocked message replaces
	// it, so focus would otherwise fall back to <body>; move it onto the message
	// once Svelte has patched the DOM for the new state.
	async function focusBlockedMessage() {
		await tick();
		blockedMessageEl?.focus();
	}

	function handleModeChange(mode: TransportMode) {
		transportMode = mode;
		dropdownOpen = false;
		travelMinutes = undefined;
		requestAndFetch(mode);
	}
</script>

{#if calculating}
	<AllerLoader size={22} speed={1.2} variant="rotate" label="Reisezeiten werden berechnet …" />
{:else if locationBlocked}
	<div class="flex flex-col items-start gap-1" role="status">
		<p
			class="text-sm text-gray-500 dark:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			tabindex="-1"
			bind:this={blockedMessageEl}
		>
			{texts.onboarding.browserLocation.blocked}
		</p>
		<Button variant="secondary" size="sm" onclick={() => location.reload()}>
			{texts.onboarding.browserLocation.reload}
		</Button>
	</div>
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
