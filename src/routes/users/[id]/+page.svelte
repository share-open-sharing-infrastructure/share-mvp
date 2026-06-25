<script lang="ts">
	import { texts } from '$lib/texts';
	import ProfileHeader from './ProfileHeader.svelte';
	import { page } from '$app/state';
	import TrustSection from './TrustSection.svelte';
	import ItemsSection from './ItemsSection.svelte';
	import {displayName} from '$lib/utils/utils';

	const { data } = $props();

	const profileName = $derived(displayName(data.profileUser));

	const isOwnProfile = $derived(data.isOwnProfile);
	const viewerTrustsProfile = $derived(data.viewerTrustsProfile);
	const profileTrustsViewer = $derived(data.profileTrustsViewer);

	const profileImageUrl = $derived(
		data.profileUser.profileImage
			? `${data.PB_IMG_URL}api/files/users/${data.profileUser.id}/${data.profileUser.profileImage}`
			: null
	);

	const activeSinceDate = $derived(
		data.profileUser.created
			? new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })
					.format(new Date(data.profileUser.created))
			: ''
	);

	const shareUrl = $derived(`${page.url.origin}/users/${data.profileUser.id}`);
</script>

<svelte:head>
	<title>{texts.seo.userProfile(profileName)}</title>
	<meta name="description" content={texts.seo.userProfileDescription(profileName)} />
	<meta property="og:title" content={texts.seo.userProfile(profileName)} />
	<meta property="og:description" content={texts.seo.userProfileDescription(profileName)} />
	<meta property="og:type" content="website" />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 space-y-8">
	<ProfileHeader
		username={data.profileUser.username}
		{profileImageUrl}
		verified={data.profileUser.verified}
		isInstitution={data.profileUser.isInstitution}
		{activeSinceDate}
		{shareUrl}
	/>

		{#if data.profileUser.bio}
			<div class="space-y-1">
				<h2 class="text-sm font-semibold text-tinte-500 dark:text-tinte-400 uppercase tracking-wide">
					{data.profileUser.isInstitution ? texts.pages.profile.bioLabelInstitution : texts.pages.profile.bioLabel}
				</h2>
				<p class="text-tinte-700 dark:text-tinte-300 whitespace-pre-wrap">
					{data.profileUser.bio}
				</p>
			</div>
		{/if}

		{#if !isOwnProfile && data.loggedIn}
			<TrustSection {profileTrustsViewer} {viewerTrustsProfile} />
		{/if}

		<ItemsSection
			publicItems={data.publicItems}
			trustedItems={data.trustedItems}
			hiddenItemsCount={data.hiddenItemsCount}
			hiddenCategories={data.hiddenCategories}
			{profileImageUrl}
			pbImgUrl={data.PB_IMG_URL}
			loggedIn={data.loggedIn}
		/>
</div>
