<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import { UserAddOutline } from 'flowbite-svelte-icons';

	interface Props {
		inviteUrl: string;
		username: string;
	}

	let { inviteUrl, username }: Props = $props();
</script>

<div class="text-center space-y-2 mb-8">
	<h2 class="text-2xl font-bold text-tinte-900 dark:text-white">
		{texts.onboarding.done.title}
	</h2>
	<p class="text-sm text-tinte-600 dark:text-tinte-400">
		{texts.onboarding.done.subtitle}
	</p>
</div>

<div class="flex flex-col gap-3">
	<a href={resolve('/search')} class="min-button py-2 px-6 bg-primary-200 hover:bg-primary flex items-center justify-center gap-2">
		<span>🔍</span>
		<span>{texts.onboarding.done.searchCta}</span>
	</a>

	<a href={resolve('/user/items')} class="min-button py-2 px-6 bg-accent-200 hover:bg-accent flex items-center justify-center gap-2">
		<span>📦</span>
		<span>{texts.onboarding.done.uploadCta}</span>
	</a>

	<div class="flex justify-center">
		<ShareButton
			url={inviteUrl}
			shareText={texts.pages.invite.shareText(username)}
			label={texts.pages.invite.shareButton}
			copiedLabel={texts.pages.invite.linkCopied}
			icon={UserAddOutline}
			class="gap-2 min-button w-full bg-primary-300 hover:bg-primary whitespace-nowrap"
		/>
	</div>
</div>
