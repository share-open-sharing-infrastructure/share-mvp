<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';

	interface Props {
		inviteUrl: string;
	}

	let { inviteUrl }: Props = $props();

	let inviteCopied = $state(false);

	function copyInviteLink() {
		navigator.clipboard.writeText(inviteUrl).then(() => {
			inviteCopied = true;
			setTimeout(() => (inviteCopied = false), 2000);
		});
	}
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

	<button
		type="button"
		onclick={copyInviteLink}
		class="min-button bg-secondary-200 py-2 px-6 hover:bg-secondary flex items-center justify-center gap-2 cursor-pointer"
	>
		<span>🤝</span>
		<span>{inviteCopied ? 'Link kopiert!' : texts.onboarding.done.inviteCta}</span>
	</button>
</div>
