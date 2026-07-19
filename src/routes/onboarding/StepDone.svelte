<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import Button from '$lib/components/ui/Button.svelte';
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
	<Button href={resolve('/search')} size="lg" fullWidth>
		<span>🔍</span>
		<span>{texts.onboarding.done.searchCta}</span>
	</Button>

	<Button href={resolve('/user/items')} variant="accent" size="lg" fullWidth>
		<span>📦</span>
		<span>{texts.onboarding.done.uploadCta}</span>
	</Button>

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
