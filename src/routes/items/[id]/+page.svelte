<script lang="ts">
	import { Badge, Alert, Tooltip } from 'flowbite-svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { HeartSolid, InfoCircleOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import { instanceUrl } from '$lib/instance';
	import { getCategoryPlaceholder } from '$lib/utils/categoryPlaceholder';
	import { itemImageUrl, itemImageUrls } from '$lib/utils/utils';
	import type { ItemPublic, UserPublic } from '$lib/types/models';
	import ItemImage from './ItemImage.svelte';
	import ItemTravelTime from './ItemTravelTime.svelte';
	import ItemCta from './ItemCta.svelte';
	import OwnerCard from './OwnerCard.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import LinkifiedText from './LinkifiedText.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';

	const { data, form } = $props();
	const item = $derived(data.item) as ItemPublic;
	const owner = $derived({
		id: item.userId,
		username: item.username,
		verified: item.verified,
		isInstitution: item.isInstitution,
		profileImage: item.profileImage,
		created: item.userCreated,
		bio: item.bio,
	}) as UserPublic;

	const isTrustRestricted = $derived(data.isTrustRestricted);
	const isOwnItem = $derived(data.isOwnItem);
	const isExternal = $derived(!!item.externalUrl);
	// Issue #368 (review): the "how the lending works" box must appear whenever the
	// borrower is sent off-platform — not only for externalUrl deep-links, but also when
	// an institution routes requests to an off-platform contact (#438: mailto / external
	// link, no externalUrl). Scoped to institutions, since the box and its override text
	// are institution-specific.
	const showLendingInfo = $derived(isExternal || (!!data.ownerContact && item.isInstitution));
	const categoryPlaceholder = $derived(getCategoryPlaceholder(item.categories));
	const isArchived = $derived(item.description?.startsWith('[Nicht mehr im Bestand]') ?? false);

	const shareUrl = $derived(`${page.url.origin}/items/${item.id}`);

	const imageUrls = $derived(itemImageUrls(data.PB_IMG_URL, item));

	const ownerImageUrl = $derived(
		owner.profileImage
			? `${data.PB_IMG_URL}api/files/users/${item.userId}/${item.profileImage}`
			: null
	);

	const seoTitle = $derived(texts.seo.itemDetail(item.name, item.username ?? ''));
	const seoDesc = $derived(
		item.description
			? item.description.replace(/\s+/g, ' ').trim().slice(0, 155)
			: texts.seo.itemDetailDescription(
					item.name,
					item.username ?? ''
				)
	);
	const seoImage = $derived(itemImageUrl(data.PB_IMG_URL, item) ?? instanceUrl('/og-invite.png'));
</script>

<SeoHead
	title={seoTitle}
	description={seoDesc}
	image={seoImage}
	canonical
/>

<div class="mx-auto max-w-3xl px-4 py-6 space-y-6">
	<!-- Archived banner -->
	{#if isArchived}
		<Alert color="yellow">
			{texts.institutional.archivedBanner}
		</Alert>
	{/if}

	<ItemImage {imageUrls} {ownerImageUrl} {categoryPlaceholder} itemName={item.name} status={item.status} />

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
		<p class="whitespace-pre-line leading-relaxed text-tinte-700 dark:text-tinte-300">
			<LinkifiedText text={item.description} />
		</p>
	{/if}

	<!-- Request error feedback (e.g. lender requirements not met on submit) -->
	{#if form?.fail && form?.message}
		<CustomAlert type="error" message={form.message} />
	{/if}

	<!-- Issue #368: permanent explanation of how borrowing works for external/institution
	     items. Shown for externalUrl deep-links AND institutions that route requests to an
	     off-platform contact (#438). Owner-provided text (data.externalLendingInfo) or a
	     shared default fallback. -->
	{#if showLendingInfo}
		<Alert color="blue" class="items-start">
			{#snippet icon()}<InfoCircleOutline class="h-5 w-5 shrink-0" />{/snippet}
			<p class="font-semibold">{texts.institutional.externalLendingInfoTitle}</p>
			<p class="mt-1 whitespace-pre-line font-normal">
				{data.externalLendingInfo ?? texts.institutional.externalLendingInfoDefault}
			</p>
		</Alert>
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
			unmetRequirements={data.unmetRequirements}
			ownerContact={data.ownerContact}
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
