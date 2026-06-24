<script lang="ts">
	import { Badge, Alert, Tooltip } from 'flowbite-svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { HeartSolid } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import { getCategoryPlaceholder } from '$lib/utils/categoryPlaceholder';
	import type { ItemPublic, UserPublic } from '$lib/types/models';
	import ItemImage from './ItemImage.svelte';
	import ItemTravelTime from './ItemTravelTime.svelte';
	import ItemCta from './ItemCta.svelte';
	import OwnerCard from './OwnerCard.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';

	const { data } = $props();
	const item = $derived(data.item) as ItemPublic;
	const owner = $derived({
		id: item.userId,
		username: item.username,
		verified: item.verified,
		isInstitution: item.isInstitution,
		profileImage: item.profileImage,
		created: item.userCreated,
	}) as UserPublic;

	const isTrustRestricted = $derived(data.isTrustRestricted);
	const isOwnItem = $derived(data.isOwnItem);
	const isExternal = $derived(!!item.externalUrl);
	const categoryPlaceholder = $derived(getCategoryPlaceholder(item.categories));
	const isArchived = $derived(item.description?.startsWith('[Nicht mehr im Bestand]') ?? false);

	const shareUrl = $derived(`${page.url.origin}/items/${item.id}`);

	const imageUrl = $derived(
		item.image
			? `${data.PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}`
			: (item.externalImgUrl ?? null)
	);

	const ownerImageUrl = $derived(
		owner.profileImage
			? `${data.PB_IMG_URL}api/files/users/${item.userId}/${item.profileImage}`
			: null
	);

	const seoTitle = $derived(texts.seo.itemDetail(item.name, item.username ?? ''));
	const seoDesc = $derived(
		item.description
			? item.description.slice(0, 155)
			: texts.seo.itemDetailDescription(
					item.name,
					item.username ?? ''
				)
	);
	const seoImage = $derived(
		item.image
			? `${data.PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}`
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

	<ItemImage {imageUrl} {ownerImageUrl} {categoryPlaceholder} itemName={item.name} status={item.status} />

	<!-- Item name -->
	<div class="flex items-center justify-between gap-3">
		<h1 class="text-3xl font-bold tracking-tight text-tinte-900 dark:text-white">
			{item.name}
		</h1>
		<ShareButton url={shareUrl} title={item.name} />
	</div>

	<!-- Status + trustees-only pills -->
	{#if item.status !== 'unknown' || item.trusteesOnly}
		<div class="flex flex-wrap gap-2 items-center">
			{#if item.status !== 'unknown'}
				<span class="text-sm font-semibold rounded-full border px-3 py-0.5 {item.status === 'available' ? 'bg-green-50 text-green-700 border-green-300' : 'bg-red-50 text-red-600 border-red-300'}">
					{item.status === 'available' ? texts.itemStatus.available : texts.itemStatus.unavailable}
				</span>
			{/if}
			{#if item.trusteesOnly}
				<span class="inline-flex items-center gap-1.5 text-sm font-semibold rounded-full border px-3 py-0.5 bg-green-50 text-green-700 border-green-300 cursor-default">
					<HeartSolid class="h-3.5 w-3.5 shrink-0" />
					{texts.ui.trustedOnly}
				</span>
				<Tooltip type="light" placement="top">{texts.pages.itemDetail.trustRestrictedTooltip}</Tooltip>
			{/if}
		</div>
	{/if}

	<!-- Categories -->
	{#if item.categories?.length}
		<div class="flex flex-wrap gap-2">
			{#each item.categories as cat (cat)}
				<Badge href="{resolve('/search')}?cats={encodeURIComponent(cat)}" class="rounded-xl text-md shadow bg-primary-100 border border-primary hover:opacity-80">{cat}</Badge>
			{/each}
		</div>
	{/if}

	<!-- Description -->
	{#if item.description}
		<p class="leading-relaxed text-tinte-700 dark:text-tinte-300">
			{item.description}
		</p>
	{/if}

	<!-- Travel Time + CTA -->
	<div class="flex items-center justify-end gap-3">
		<div>
			{#if data.isAuthenticated && !isOwnItem && data.ownerHasLocation}
				<ItemTravelTime
					itemId={item.id}
					preferredTransportMode={data.preferredTransportMode}
				/>
			{/if}
		</div>
		<ItemCta
			item={item}
			{isExternal}
			{isOwnItem}
			{isTrustRestricted}
			{isArchived}
			existingConversation={data.existingConversation}
			requiresTermsAcceptance={data.requiresTermsAcceptance}
		/>
	</div>

	<!-- Owner card -->
	<OwnerCard
		owner={owner}
		pbImgUrl={data.PB_IMG_URL}
		ownerTrustsViewer={data.ownerTrustsViewer}
		ownerItemCount={data.ownerItemCount}
		isAuthenticated={data.isAuthenticated}
		{isOwnItem}
	/>
</div>
