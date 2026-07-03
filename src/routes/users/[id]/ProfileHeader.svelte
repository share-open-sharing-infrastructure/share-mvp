<script lang="ts">
	import { UserCircleOutline, HomeOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import VerifiedIcon from '$lib/components/VerifiedIcon.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';

	interface Props {
		username: string;
		profileImageUrl: string | null;
		verified?: boolean;
		isInstitution?: boolean;
		activeSinceDate: string;
		shareUrl: string;
	}

	const { username, profileImageUrl, verified, isInstitution, activeSinceDate, shareUrl }: Props = $props();
</script>

<div class="flex items-center gap-6">
	<div class="h-20 w-20 rounded-full bg-tinte-100 flex items-center justify-center shrink-0 overflow-hidden">
		{#if profileImageUrl}
			<img src={profileImageUrl} alt={username} class="h-full w-full object-cover" />
		{:else if isInstitution}
			<HomeOutline class="h-14 w-14 text-tinte-400" />
		{:else}
			<UserCircleOutline class="h-14 w-14 text-tinte-400" />
		{/if}
	</div>
	<div class="space-y-1">
		<div class="flex items-center gap-2 flex-wrap">
			<h1 class="text-2xl font-bold text-tinte-900 dark:text-white">
				{username}
			</h1>
			<ShareButton url={shareUrl} title={`@${username}`} />
		</div>
		{#if verified}
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
