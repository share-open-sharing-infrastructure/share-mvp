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
	<h2 class="text-2xl font-bold text-gray-900 dark:text-white">
		{texts.onboarding.done.title}
	</h2>
	<p class="text-sm text-gray-600 dark:text-gray-400">
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
		class="flex items-center gap-3 w-full py-4 px-5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer"
	>
		<span class="text-xl">🤝</span>
		<span>{inviteCopied ? 'Link kopiert!' : texts.onboarding.done.inviteCta}</span>
	</button>
</div>
