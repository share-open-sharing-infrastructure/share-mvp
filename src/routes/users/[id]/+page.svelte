<script lang="ts">
	import { enhance } from '$app/forms';
	import { Toggle, Badge } from 'flowbite-svelte';
	import { AccordionItem, Accordion } from 'flowbite-svelte';
	import { UserCircleOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import ItemCard from '../../search/ItemCard.svelte';
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
	{#if !isOwnProfile}
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

	<Accordion multiple>
		<AccordionItem open>
			{#snippet header()}{texts.pages.userProfile.publicItems}{/snippet}
			<!-- Public Items Section -->
			<section>
				{#if publicItems.length === 0}
					<p class="text-tinte-500 dark:text-tinte-400">
						{texts.pages.userProfile.noPublicItems}
					</p>
				{:else}
					<div class="space-y-2">
						{#each publicItems as item (item.id)}
							<ItemCard
								{item}
								imgUrl={item.image ? `${data.PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}` : (item.externalImgUrl ?? '')}
								ownerImgUrl={profileImageUrl ?? undefined}
								profileView={true}
							/>
						{/each}
					</div>
				{/if}
			</section>
		</AccordionItem>
		<AccordionItem>
			{#snippet header()}
						{texts.pages.userProfile.trustedItems}{/snippet}
			<!-- Trusted-Only Items Section -->
			{#if trustedItems !== null && trustedItems.length > 0}
					<div class="space-y-3">
						{#each trustedItems as item (item.id)}
							<ItemCard
								{item}
								imgUrl={item.image ? `${data.PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${item.image}` : (item.externalImgUrl ?? '')}
								ownerImgUrl={profileImageUrl ?? undefined}
								profileView={true}
							/>
						{/each}
					</div>
			{:else if trustedItems === null}
				<section class="space-y-2">
					<p class="text-tinte-500 dark:text-tinte-400">
						{texts.pages.userProfile.notTrustedNote}
					</p>
				</section>
			{/if}
		</AccordionItem>
	</Accordion>
</div>
