<script lang="ts">
	import { Button, Tooltip, Input, Badge, Dropdown, DropdownItem } from 'flowbite-svelte';
	import { UserCircleOutline, ImageOutline, MessagesOutline, ChevronDownOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';

	type TransportMode = 'foot' | 'bicycle' | 'car';
	import VerifiedIcon from '$lib/components/VerifiedIcon.svelte';

	const { data } = $props();
	// svelte-ignore state_referenced_locally
	const { item, PB_IMG_URL } = data;
	const isTrustRestricted = $derived(data.isTrustRestricted);
	const isOwnItem = $derived(data.isOwnItem);

	const imageUrl =
		item.image
			? `${PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}`
			: null;

	const seoTitle = texts.seo.itemDetail(item.name, item.expand?.owner?.username ?? '');
	const seoDesc = item.description
		? item.description.slice(0, 155)
		: texts.seo.itemDetailDescription(
				item.name,
				item.expand?.owner?.username ?? '',
				item.expand?.owner?.city ?? '',
			);
	const seoImage = item.image
		? `${PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}`
		: 'https://allerleih.org/og-invite.png';

	const initialMode = untrack(() => (data.preferredTransportMode as TransportMode) ?? 'bicycle');
	let transportMode = $state<TransportMode>(initialMode);
	let travelMinutes = $state<number | null | undefined>(undefined);
	let dropdownOpen = $state(false);
	let calculating = $state(false);
	let cachedUserLocation: { lon: number; lat: number } | null = null;

	async function fetchTravelTime(mode: TransportMode, userLocation: { lon: number; lat: number }) {
		const ownerGeo = item.expand?.owner?.geolocation as { lon: number; lat: number } | undefined;
		if (!ownerGeo || (ownerGeo.lon === 0 && ownerGeo.lat === 0)) {
			travelMinutes = null;
			calculating = false;
			return;
		}
		try {
			const res = await fetch('/api/travel-times', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userLocation,
					transportMode: mode,
					owners: [{ id: item.expand!.owner!.id, lon: ownerGeo.lon, lat: ownerGeo.lat }],
				}),
			});
			if (res.ok) {
				const map: Record<string, number> = await res.json();
				travelMinutes = map[item.expand!.owner!.id] ?? null;
			}
		} catch {
			// silently skip
		} finally {
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

<svelte:head>
	<title>{seoTitle}</title>
	<meta name="description" content={seoDesc} />
	<meta property="og:title" content={seoTitle} />
	<meta property="og:description" content={seoDesc} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content={seoImage} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={seoTitle} />
	<meta name="twitter:description" content={seoDesc} />
	<meta name="twitter:image" content={seoImage} />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 space-y-6">
	<!-- Image -->
	{#if imageUrl}
		<img
			src={imageUrl}
			alt={item.name}
			class="w-full max-h-96 object-contain rounded-lg bg-papier"
		/>
	{:else}
		<div class="w-full h-64 flex flex-col items-center justify-center rounded-lg bg-tinte-100 text-tinte-400 gap-2">
			<ImageOutline class="h-16 w-16" />
			<span class="text-sm">{texts.pages.itemDetail.noImage}</span>
		</div>
	{/if}

	<!-- Owner + Travel Time (directly below image) -->
	<div class="flex items-center justify-between">
		<!-- Owner -->
		<div class="gap-2">
			<a href={resolve('/users/[id]', { id: item.expand?.owner?.id ?? '' })} 
				class="rounded-full border w-40 hover:cursor-pointer pl-2 pr-4 py-1 bg-white text-tinte-700 border-tinte-300 hover:bg-tinte-50'}">
				<UserCircleOutline class="h-6 w-6 inline" />
			<span class="font-medium text-md">{item.expand?.owner?.username ?? 'Unknown'}</span>
			<div class="absolute top-0 -left-2.5 flex flex-col gap-0.1 items-center">
				{#if item.expand?.owner?.verified}
					<VerifiedIcon class="h-3.5 w-3.5" />
				{/if}
				<!-- {#if isTrusted}
					<HeartSolid class="h-3.5 w-3.5 text-green-500 bg-white rounded-full" />
				{/if} -->
			</div>
			</a>
		</div>
		<!-- Travel Time -->
		{#if data.isAuthenticated && !isOwnItem}
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
					{#if transportMode === 'foot'}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
							<path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/>
						</svg>
					{:else if transportMode === 'bicycle'}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
							<path d="M15.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM5 12.5a4.5 4.5 0 1 0 9 0 4.5 4.5 0 0 0-9 0zm2 0a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm8-4.5-3.5-4H8v2h2.8l2.1 2.5-4.4 3.5H4v2h5l3.6-2.9 1.8 2.1-.5 3.3H16v-4.2l-1-1.3zM19 8a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/>
						</svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
							<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
						</svg>
					{/if}
					{texts.pages.search.minutesAway(travelMinutes)}
					<ChevronDownOutline class="h-3 w-3 ml-0.5" />
				</button>
				<Dropdown bind:isOpen={dropdownOpen} triggeredBy="#item-transport-btn" placement="bottom-end">
					{#each (['foot', 'bicycle', 'car'] as const) as m (m)}
						<DropdownItem onclick={() => handleModeChange(m)} classes={{ li: 'list-none' }} class={transportMode === m ? 'font-semibold text-primary' : ''}>
							<span class="flex items-center gap-2">
								{#if m === 'foot'}
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
										<path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/>
									</svg>
								{:else if m === 'bicycle'}
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
										<path d="M15.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM5 12.5a4.5 4.5 0 1 0 9 0 4.5 4.5 0 0 0-9 0zm2 0a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm8-4.5-3.5-4H8v2h2.8l2.1 2.5-4.4 3.5H4v2h5l3.6-2.9 1.8 2.1-.5 3.3H16v-4.2l-1-1.3zM19 8a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/>
									</svg>
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
										<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
									</svg>
								{/if}
								{texts.pages.search.transportModes[m]}
							</span>
						</DropdownItem>
					{/each}
				</Dropdown>
			</div>
		{/if}
		{/if}
	</div>

	<!-- Item name -->
	<h1 class="text-3xl font-bold tracking-tight text-tinte-900 dark:text-white">
		{item.name}
	</h1>

	<!-- Categories -->
	{#if item.categories && item.categories.length > 0}
		<div class="flex flex-wrap gap-2">
			{#each item.categories as cat(cat)}
				<Badge color="indigo" class="rounded-lg text-md shadow">{cat}</Badge>
			{/each}
		</div>
	{/if}

	<!-- Description -->
	{#if item.description}
		<p class="leading-relaxed text-tinte-700 dark:text-tinte-300">
			{item.description}
		</p>
	{/if}

	<!-- Anfragen CTA / Status Toggle -->
	<div class="flex justify-end">
		{#if isOwnItem}
			<form method="POST" action="?/toggleStatus" use:enhance>
				<button
					type="submit"
					class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold border transition-colors cursor-pointer
						{data.item.status === 'available'
							? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
							: 'bg-accent-100 text-accent-800 border-accent-300 hover:bg-accent-200'}"
				>
					{data.item.status === 'available' ? texts.itemStatus.available : texts.itemStatus.unavailable}
					<span class="ml-2 text-xs opacity-60">
						{'→ ' + (data.item.status === 'available' ? texts.itemStatus.markUnavailable : texts.itemStatus.markAvailable)}
					</span>
				</button>
			</form>
		{:else if isTrustRestricted}
			<!-- Disabled buttons suppress pointer events, so the tooltip must be anchored
			     to the surrounding span instead of the button itself. -->
			<span id="anfragen-disabled" class="cursor-not-allowed">
				<Button pill disabled class="min-button bg-primary-200 hover:bg-primary opacity-50 pointer-events-none">
					<MessagesOutline class="h-4 w-4 mr-2" />
					{texts.pages.itemDetail.requestButton}
				</Button>
			</span>
			<Tooltip triggeredBy="#anfragen-disabled" type="light" placement="top" trigger="click">
				{texts.pages.itemDetail.trustRestrictedTooltip}
			</Tooltip>
		{:else}
			<form method="POST" action="?/startConversation">
				<Input name="itemId" value={item.id} hidden />
				<Input name="ownerId" value={item.expand?.owner?.id} hidden />
				<Button pill type="submit" class="cursor-pointer min-button bg-primary-200 hover:bg-primary">
					<MessagesOutline class="h-4 w-4 mr-2" />
					{texts.pages.itemDetail.requestButton}
				</Button>
			</form>
		{/if}
	</div>
</div>
