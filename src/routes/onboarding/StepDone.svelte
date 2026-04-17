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
	<a
		href={resolve('/search')}
		class="flex items-center gap-3 w-full py-4 px-5 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
	>
		<span class="text-xl">🔍</span>
		<span>{texts.onboarding.done.searchCta}</span>
	</a>

	<a
		href={resolve('/user/items')}
		class="flex items-center gap-3 w-full py-4 px-5 bg-accent text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
	>
		<span class="text-xl">📦</span>
		<span>{texts.onboarding.done.uploadCta}</span>
	</a>

	<button
		type="button"
		onclick={copyInviteLink}
		class="flex items-center gap-3 w-full py-4 px-5 bg-sand dark:bg-tinte-700 border border-tinte-200 dark:border-tinte-600 text-tinte-800 dark:text-tinte-200 font-semibold rounded-xl hover:bg-papier dark:hover:bg-tinte-600 transition-colors cursor-pointer"
	>
		<span class="text-xl">🤝</span>
		<span>{inviteCopied ? 'Link kopiert!' : texts.onboarding.done.inviteCta}</span>
	</button>
</div>
