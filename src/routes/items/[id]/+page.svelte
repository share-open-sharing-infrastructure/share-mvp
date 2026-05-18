<script lang="ts">
	import { Badge, Alert } from 'flowbite-svelte';
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

	<!-- Categories -->
	{#if data.item.categories?.length}
		<div class="flex flex-wrap gap-2">
			{#each data.item.categories as cat (cat)}
				<Badge class="rounded-xl text-md shadow bg-primary-100 border border-primary">{cat}</Badge>
			{/each}
		</div>
	{/if}

	<!-- Description -->
	{#if data.item.description}
		<p class="leading-relaxed text-tinte-700 dark:text-tinte-300">
			{data.item.description}
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
