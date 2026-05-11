<script lang="ts">
	import { Button, Tooltip, Input, Badge, Dropdown, DropdownItem, Alert } from 'flowbite-svelte';
	import { UserCircleOutline, ImageOutline, MessagesOutline, ChevronDownOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';

	type TransportMode = 'foot' | 'bicycle' | 'car';
	import VerifiedIcon from '$lib/components/VerifiedIcon.svelte';
	import { getCategoryPlaceholder } from '$lib/utils/categoryPlaceholder';

	const { data } = $props();
	// svelte-ignore state_referenced_locally
	const { item, PB_IMG_URL } = data;
	const isTrustRestricted = $derived(data.isTrustRestricted);
	const isOwnItem = $derived(data.isOwnItem);

	const imageUrl =
		item.image
			? `${PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}`
			: (item.externalImgUrl ?? null);

	const ownerImageUrl = $derived(
		item.expand?.owner?.profileImage
			? `${PB_IMG_URL}api/files/users/${item.expand.owner.id}/${item.expand.owner.profileImage}`
			: null
	);

	const isExternal = $derived(!!item.externalUrl);
	const categoryPlaceholder = $derived(getCategoryPlaceholder(item.categories));
	const isArchived = $derived(item.description?.startsWith('[Nicht mehr im Bestand]') ?? false);
	const isInstitution = $derived(!!item.expand?.owner?.isInstitution);

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
	<!-- Archived banner -->
	{#if isArchived}
		<Alert color="yellow">
			{texts.institutional.archivedBanner}
		</Alert>
	{/if}

	<!-- Image -->
	{#if imageUrl}
		<img
			src={imageUrl}
			alt={item.name}
			class="w-full max-h-96 object-contain rounded-lg bg-papier"
		/>
	{:else if ownerImageUrl}
		<div class="w-full h-64 flex flex-col items-center justify-center rounded-lg bg-tinte-100 relative overflow-hidden">
			<img src={ownerImageUrl} alt="" class="absolute inset-0 w-full h-full object-cover opacity-30" />
			<span class="relative text-sm text-tinte-400">{texts.institutional.imagePlaceholder}</span>
		</div>
	{:else if categoryPlaceholder}
		<div class="w-full h-64 flex items-center justify-center rounded-lg bg-tinte-100">
			<img src={categoryPlaceholder} alt="" class="h-40 w-40 object-contain opacity-25" />
		</div>
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

	<!-- Availability / CTA -->
	<div class="flex justify-end items-center gap-3">
		{#if isExternal}
			<!-- External item: deep-link CTA -->
			{#if item.status === 'unknown'}
				<span class="text-sm text-tinte-500 dark:text-tinte-400">
					{texts.institutional.availabilityHintExternal}
				</span>
			{:else}
				<span class="text-sm font-semibold rounded-full px-3 py-1 {item.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-accent-100 text-accent-800'}">
					{item.status === 'available' ? texts.itemStatus.available : texts.itemStatus.unavailable}
				</span>
			{/if}
			{#if !isArchived}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={item.externalUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold bg-primary-200 hover:bg-primary text-tinte-900 transition-colors"
				>
					{texts.institutional.externalLendCta(item.expand?.owner?.username ?? '')}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		{:else if isOwnItem}
			<!-- Own item: status toggle -->
			<form method="POST" action="?/toggleStatus" use:enhance>
				<button
					type="submit"
					class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold border transition-colors cursor-pointer
						{data.item.status === 'available'
							? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
							: data.item.status === 'unavailable'
							? 'bg-accent-100 text-accent-800 border-accent-300 hover:bg-accent-200'
							: 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'}"
				>
					{data.item.status === 'available'
						? texts.itemStatus.available
						: data.item.status === 'unavailable'
						? texts.itemStatus.unavailable
						: texts.itemStatus.unknown}
					{#if data.item.status !== 'unknown'}
						<span class="ml-2 text-xs opacity-60">
							{'→ ' + (data.item.status === 'available' ? texts.itemStatus.markUnavailable : texts.itemStatus.markAvailable)}
						</span>
					{/if}
				</button>
			</form>
		{:else if item.status === 'unknown'}
			<!-- Non-owner, internal, unknown status -->
			<span class="text-sm rounded-full px-3 py-1 bg-gray-100 text-gray-500 border border-gray-200">
				{texts.institutional.availabilityHintUnknown}
			</span>
		{:else if isTrustRestricted}
			<Button pill disabled class="min-button bg-primary-200 hover:bg-primary opacity-50 cursor-not-allowed">
				<MessagesOutline class="h-4 w-4 mr-2" />
				{texts.pages.itemDetail.requestButton}
			</Button>
			<Tooltip type="light" placement="top">
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

	<!-- "Über die Institution" card — shown when owner is institutional -->
	{#if isInstitution}
		<div class="rounded-lg border border-tinte-200 dark:border-tinte-700 p-4 space-y-3 bg-sand dark:bg-tinte-800">
			<h2 class="text-sm font-semibold text-tinte-500 dark:text-tinte-400 uppercase tracking-wide">
				{texts.institutional.institutionCardTitle}
			</h2>
			<div class="flex items-center gap-3">
				{#if ownerImageUrl}
					<img
						src={ownerImageUrl}
						alt={item.expand?.owner?.username ?? ''}
						class="h-12 w-12 rounded-full object-cover shrink-0"
					/>
				{:else}
					<UserCircleOutline class="h-12 w-12 text-tinte-400 shrink-0" />
				{/if}
				<div class="min-w-0">
					<a
						href={resolve('/users/[id]', { id: item.expand?.owner?.id ?? '' })}
						class="font-semibold text-tinte-900 dark:text-white hover:text-primary hover:underline"
					>
						{item.expand?.owner?.username ?? ''}
					</a>
					{#if item.expand?.owner?.bio}
						<p class="text-sm text-tinte-500 dark:text-tinte-400 line-clamp-3 mt-1 whitespace-pre-wrap">
							{item.expand.owner.bio}
						</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
