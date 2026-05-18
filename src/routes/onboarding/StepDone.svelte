<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import InviteShareButton from '$lib/components/InviteShareButton.svelte';

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

	<div class="flex justify-center">
		<InviteShareButton {inviteUrl} {username} />
	</div>
</div>
