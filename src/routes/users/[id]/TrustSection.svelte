<script lang="ts">
	import { enhance } from '$app/forms';
	import { Toggle } from 'flowbite-svelte';
	import { texts } from '$lib/texts';

	interface Props {
		profileTrustsViewer: boolean;
		viewerTrustsProfile: boolean;
	}

	const { profileTrustsViewer, viewerTrustsProfile }: Props = $props();

	let trustForm: HTMLFormElement = $state()!;
</script>

<div class="rounded-lg border border-tinte-200 dark:border-primary-700 p-4 space-y-3">
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
