<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import VerifiedIcon from '$lib/components/VerifiedIcon.svelte';

	interface Props {
		email: string;
		verified: boolean;
	}

	const { email, verified }: Props = $props();
</script>

<div class="space-y-2">
	<!-- Email display + change link -->
	<p class="text-sm font-medium text-gray-900 dark:text-white">
		{texts.ui.emailAddress}
		<span class="rounded-lg text-gray-700 dark:text-gray-300">{email}</span>
		<span class="text-gray-600 dark:text-gray-400">
			(<a href={resolve('/user/profile/updatemail')} class="font-medium text-primary hover:underline">ändern</a>)
		</span>
	</p>

	<!-- Verification status -->
	{#if verified}
		<p class="flex items-center gap-2 text-sm text-green-600 font-medium">
			<VerifiedIcon class="h-4 w-4" />
			{texts.pages.profile.emailVerified}
		</p>
	{:else}
		<p class="text-sm text-accent-600 dark:text-accent-400">
			{texts.pages.profile.emailNotVerified}
		</p>
		<form method="POST" action="?/resendVerification" use:enhance>
			<button
				type="submit"
				class="text-sm font-medium text-primary hover:text-primary-800 hover:underline cursor-pointer dark:text-primary-400 dark:hover:text-primary-300"
			>
				{texts.pages.profile.resendVerification}
			</button>
		</form>
	{/if}
</div>
