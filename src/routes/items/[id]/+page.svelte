<script lang="ts">
	import { Badge, Alert, Tooltip } from 'flowbite-svelte';
	import { resolve } from '$app/paths';
	import { HeartSolid } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import { getCategoryPlaceholder } from '$lib/utils/categoryPlaceholder';
	import ItemImage from './ItemImage.svelte';
	import ItemTravelTime from './ItemTravelTime.svelte';
	import ItemCta from './ItemCta.svelte';
	import OwnerCard from './OwnerCard.svelte';

	const { data } = $props();

	const isTrustRestricted = $derived(data.isTrustRestricted);
	const isOwnItem = $derived(data.isOwnItem);
	const isExternal = $derived(!!data.item.externalUrl);
	const categoryPlaceholder = $derived(getCategoryPlaceholder(data.item.categories));
	const isArchived = $derived(data.item.description?.startsWith('[Nicht mehr im Bestand]') ?? false);

	const imageUrl = $derived(
		data.item.image
			? `${data.PB_IMG_URL}api/files/${data.item.collectionId}/${data.item.id}/${data.item.image}`
			: (data.item.externalImgUrl ?? null)
	);

	const ownerImageUrl = $derived(
		data.item.expand?.owner?.profileImage
			? `${data.PB_IMG_URL}api/files/users/${data.item.expand.owner.id}/${data.item.expand.owner.profileImage}`
			: null
	);

	const seoTitle = $derived(texts.seo.itemDetail(data.item.name, data.item.expand?.owner?.username ?? ''));
	const seoDesc = $derived(
		data.item.description
			? data.item.description.slice(0, 155)
			: texts.seo.itemDetailDescription(
					data.item.name,
					data.item.expand?.owner?.username ?? '',
					data.item.expand?.owner?.city ?? '',
				)
	);
	const seoImage = $derived(
		data.item.image
			? `${data.PB_IMG_URL}api/files/${data.item.collectionId}/${data.item.id}/${data.item.image}`
			: 'https://allerleih.org/og-invite.png'
	);
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

	<ItemImage {imageUrl} {ownerImageUrl} {categoryPlaceholder} itemName={data.item.name} status={data.item.status} />

	<!-- Item name -->
	<h1 class="text-3xl font-bold tracking-tight text-tinte-900 dark:text-white">
		{data.item.name}
	</h1>

	<!-- Status + trustees-only pills -->
	{#if data.item.status !== 'unknown' || data.item.trusteesOnly}
		<div class="flex flex-wrap gap-2 items-center">
			{#if data.item.status !== 'unknown'}
				<span class="text-sm font-semibold rounded-full border px-3 py-0.5 {data.item.status === 'available' ? 'bg-green-50 text-green-700 border-green-300' : 'bg-red-50 text-red-600 border-red-300'}">
					{data.item.status === 'available' ? texts.itemStatus.available : texts.itemStatus.unavailable}
				</span>
			{/if}
			{#if data.item.trusteesOnly}
				<span class="inline-flex items-center gap-1.5 text-sm font-semibold rounded-full border px-3 py-0.5 bg-green-50 text-green-700 border-green-300 cursor-default">
					<HeartSolid class="h-3.5 w-3.5 shrink-0" />
					{texts.ui.trustedOnly}
				</span>
				<Tooltip type="light" placement="top">{texts.pages.itemDetail.trustRestrictedTooltip}</Tooltip>
			{/if}
		</div>
	{/if}

	<!-- Categories -->
	{#if data.item.categories?.length}
		<div class="flex flex-wrap gap-2">
			{#each data.item.categories as cat (cat)}
				<Badge href="{resolve('/search')}?cats={encodeURIComponent(cat)}" class="rounded-xl text-md shadow bg-primary-100 border border-primary hover:opacity-80">{cat}</Badge>
			{/each}
		</div>
	{/if}

	<!-- Description -->
	{#if data.item.description}
		<p class="leading-relaxed text-tinte-700 dark:text-tinte-300">
			{data.item.description}
		</p>
	{/if}

	<!-- Travel Time + CTA -->
	<div class="flex items-center justify-end gap-3">
		<div>
			{#if data.isAuthenticated && !isOwnItem && data.ownerHasLocation}
				<ItemTravelTime
					itemId={data.item.id}
					preferredTransportMode={data.preferredTransportMode}
				/>
			{/if}
		</div>
		<ItemCta
			item={data.item}
			{isExternal}
			{isOwnItem}
			{isTrustRestricted}
			{isArchived}
			existingConversation={data.existingConversation}
			requiresTermsAcceptance={data.requiresTermsAcceptance}
		/>
	</div>

	<!-- Owner card -->
	{#if data.item.expand?.owner}
		<OwnerCard
			owner={data.item.expand.owner}
			{ownerImageUrl}
			ownerTrustsViewer={data.ownerTrustsViewer}
			ownerItemCount={data.ownerItemCount}
			isAuthenticated={data.isAuthenticated}
			{isOwnItem}
		/>
	{/if}
</div>
