<script lang="ts">
	import { enhance } from '$app/forms';
	import { Toggle, Badge } from 'flowbite-svelte';
	import { UserCircleOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import ItemCard from '../../search/ItemCard.svelte';
	import LockedItemCard from './LockedItemCard.svelte';
	import VerifiedIcon from '$lib/components/VerifiedIcon.svelte';

	const { data } = $props();
	const profileUser = $derived(data.profileUser);
	const publicItems = $derived(data.publicItems);
	const trustedItems = $derived(data.trustedItems);
	const isOwnProfile = $derived(data.isOwnProfile);
	const viewerTrustsProfile = $derived(data.viewerTrustsProfile);
	const profileTrustsViewer = $derived(data.profileTrustsViewer);

	// svelte-ignore state_referenced_locally
	const activeSinceDate = new Intl.DateTimeFormat('de-DE', {
		month: 'long',
		year: 'numeric',
	}).format(new Date(profileUser.created));

	const profileImageUrl = $derived(
		profileUser.profileImage
			? `${data.PB_IMG_URL}api/files/users/${profileUser.id}/${profileUser.profileImage}`
			: null
	);

	let trustForm: HTMLFormElement = $state()!;

	let selectedCategory = $state<string | null>(null);

	const allVisibleItems = $derived([...publicItems, ...(trustedItems ?? [])]);
	const categories = $derived(
		[...new Set([
			...allVisibleItems.flatMap((i) => i.categories ?? []),
			...data.hiddenCategories,
		])].sort()
	);
	const categoryCounts = $derived(
		Object.fromEntries(
			categories.map((cat) => [cat, allVisibleItems.filter((i) => (i.categories ?? []).includes(cat)).length])
		)
	);
	const hiddenCategoryCounts = $derived(
		data.hiddenCategories.reduce<Record<string, number>>((acc, cat) => {
			acc[cat] = (acc[cat] ?? 0) + 1;
			return acc;
		}, {})
	);

	const displayedItems = $derived(
		selectedCategory === null
			? allVisibleItems
			: allVisibleItems.filter((i) => (i.categories ?? []).includes(selectedCategory!))
	);
	const ghostIndices = $derived(
		data.trustedItems !== null
			? []
			: Array.from(
				{ length: Math.min(selectedCategory === null ? data.hiddenItemsCount : (hiddenCategoryCounts[selectedCategory] ?? 0), 3) },
				(_, i) => i
			)
	);
</script>

<svelte:head>
	<title>{texts.seo.userProfile(profileUser.username)}</title>
	<meta name="description" content={texts.seo.userProfileDescription(profileUser.username)} />
	<meta property="og:title" content={texts.seo.userProfile(profileUser.username)} />
	<meta property="og:description" content={texts.seo.userProfileDescription(profileUser.username)} />
	<meta property="og:type" content="website" />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 space-y-8">
	<!-- Profile Header -->
	<div class="flex items-center gap-6">
		<div class="h-20 w-20 rounded-full bg-tinte-100 flex items-center justify-center shrink-0 overflow-hidden">
			{#if profileImageUrl}
				<img src={profileImageUrl} alt={profileUser.username} class="h-full w-full object-cover" />
			{:else}
				<UserCircleOutline class="h-14 w-14 text-tinte-400" />
			{/if}
		</div>
		<div class="space-y-1">
			<div class="flex items-center gap-2 flex-wrap">
				<h1 class="text-2xl font-bold text-tinte-900 dark:text-white">
					@{profileUser.username}
				</h1>
				{#if profileUser.isInstitution}
					<Badge color="purple">{texts.institutional.badge}</Badge>
				{/if}
			</div>

			{#if profileUser.verified}
				<p class="flex items-center gap-1 text-sm text-green-600 font-medium">
					<VerifiedIcon class="h-4 w-4" />
					{texts.pages.userProfile.emailVerified}
				</p>
			{/if}
			<p class="text-sm text-tinte-500 dark:text-tinte-400">
				{texts.pages.userProfile.activeSince(activeSinceDate)}
			</p>
		</div>
	</div>

	<!-- Bio section -->
	{#if profileUser.bio}
		<div class="space-y-1">
			<h2 class="text-sm font-semibold text-tinte-500 dark:text-tinte-400 uppercase tracking-wide">
				{profileUser.isInstitution ? texts.pages.profile.bioLabelInstitution : texts.pages.profile.bioLabel}
			</h2>
			<p class="text-tinte-700 dark:text-tinte-300 whitespace-pre-wrap">
				{profileUser.bio}
			</p>
		</div>
	{/if}

	<!-- Trust Section (hidden on own profile) -->
	{#if !isOwnProfile && data.loggedIn}
		<div
			class="rounded-lg border border-tinte-200 dark:border-primary-700 p-4 space-y-3"
		>
			<!-- Does the profile owner trust the viewer? -->
			<p class="text-sm text-tinte-600 dark:text-tinte-400">
				{#if profileTrustsViewer}
					✓ {texts.pages.userProfile.trustsYou}
				{:else}
					{texts.pages.userProfile.doesNotTrustYou}
				{/if}
			</p>

			<!-- Does the viewer trust the profile owner? -->
			<form
				method="POST"
				action={viewerTrustsProfile ? '?/removeTrust' : '?/addTrust'}
				use:enhance
				bind:this={trustForm}
			>
				<Toggle
					checked={viewerTrustsProfile}
					onchange={() => trustForm?.requestSubmit()}
				>
					{viewerTrustsProfile
						? texts.pages.userProfile.trustsThisUser
						: texts.pages.userProfile.doesNotTrustThisUser}
				</Toggle>
			</form>
		</div>
	{/if}

	<!-- Items section -->
	<section class="space-y-4">
		<h2 class="text-sm font-semibold text-tinte-500 dark:text-tinte-400 uppercase tracking-wide">
			{texts.pages.userProfile.itemsSectionTitle}
		</h2>

		{#if categories.length > 0}
			<div class="flex flex-wrap gap-2">
				<button
					class="px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer
						{selectedCategory === null
							? 'bg-accent text-white'
							: 'bg-tinte-100 dark:bg-tinte-700 text-tinte-600 dark:text-tinte-300 hover:bg-tinte-200 dark:hover:bg-tinte-600'}"
					onclick={() => (selectedCategory = null)}
				>
					{texts.pages.userProfile.allCategories}
					<span class="ml-1 text-xs opacity-60">{allVisibleItems.length}{#if data.hiddenItemsCount > 0}&nbsp;(+{data.hiddenItemsCount}){/if}</span>
				</button>
				{#each categories as cat (cat)}
					<button
						class="px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer
							{selectedCategory === cat
								? 'bg-accent text-white'
								: 'bg-tinte-100 dark:bg-tinte-700 text-tinte-600 dark:text-tinte-300 hover:bg-tinte-200 dark:hover:bg-tinte-600'}"
						onclick={() => (selectedCategory = cat)}
					>
						{cat}
						<span class="ml-1 text-xs opacity-60">{categoryCounts[cat]}{#if hiddenCategoryCounts[cat]}&nbsp;(+{hiddenCategoryCounts[cat]}){/if}</span>
					</button>
				{/each}
			</div>
		{/if}

		{#if displayedItems.length === 0 && ghostIndices.length === 0}
			<p class="text-tinte-500 dark:text-tinte-400 text-sm">
				{selectedCategory !== null
					? texts.pages.userProfile.noItemsInCategory
					: texts.pages.userProfile.noItemsOnProfile}
			</p>
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{#each displayedItems as item (item.id)}
					<ItemCard
						{item}
						imgUrl={item.image ? `${data.PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}` : (item.externalImgUrl ?? '')}
						ownerImgUrl={profileImageUrl ?? undefined}
						profileView={true}
					/>
				{/each}
				{#each ghostIndices as i (i)}
					{@const hiddenCount = selectedCategory === null ? data.hiddenItemsCount : (hiddenCategoryCounts[selectedCategory] ?? 0)}
					<LockedItemCard
						id="locked-item-{i}"
						loggedIn={data.loggedIn}
						isOverflow={hiddenCount > 3 && i === 2}
						overflowCount={hiddenCount - 2}
					/>
				{/each}
			</div>
		{/if}
	</section>
</div>
