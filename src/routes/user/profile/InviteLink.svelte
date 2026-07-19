<script lang="ts">
	import { texts } from '$lib/texts';
	import { ClipboardOutline, CheckOutline } from 'flowbite-svelte-icons';
	import Button from '$lib/components/ui/Button.svelte';

	let { inviteUrl }: { inviteUrl: string } = $props();

	let inviteCopied = $state(false);

	async function copyInviteLink() {
		await navigator.clipboard.writeText(inviteUrl);
		inviteCopied = true;
		setTimeout(() => (inviteCopied = false), 2000);
	}
</script>

<div class="bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-6 sm:p-8">
	<h2 class="text-lg font-semibold text-tinte-900 dark:text-white mb-2">
		{texts.pages.invite.sectionTitle}
	</h2>
	<p class="text-sm text-tinte-600 dark:text-tinte-400 mb-4">
		{texts.pages.invite.description}
	</p>
	<div class="relative">
		<input
			type="text"
			readonly
			value={inviteUrl}
			class="w-full px-3 py-2 pr-10 bg-tinte-100 border border-tinte-200 rounded-lg text-sm text-tinte-600 cursor-default dark:bg-tinte-700 dark:border-tinte-600 dark:text-tinte-400 truncate"
		/>
		<Button
			variant="ghost"
			size="icon-sm"
			onclick={copyInviteLink}
			aria-label={texts.pages.invite.copyButton}
			class="absolute right-2 top-1/2 -translate-y-1/2"
		>
			{#if inviteCopied}
				<CheckOutline class="h-5 w-5 text-safety" />
			{:else}
				<ClipboardOutline class="h-5 w-5" />
			{/if}
		</Button>
	</div>
</div>
