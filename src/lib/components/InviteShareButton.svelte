<script lang="ts">
	import { browser } from '$app/environment';
	import { texts } from '$lib/texts';
	import { Button } from 'flowbite-svelte';
	import { UserAddOutline, CheckOutline } from 'flowbite-svelte-icons';

	let { inviteUrl, username }: { inviteUrl: string; username: string } = $props();

	let copied = $state(false);

	async function share() {
		const text = texts.pages.invite.shareText(username);
		if (browser && navigator.share) {
			try {
				await navigator.share({ title: 'AllerLeih', text, url: inviteUrl });
			} catch {
				// user cancelled — do nothing
			}
			return;
		}

		try {
			await navigator.clipboard.writeText(text + inviteUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// clipboard unavailable (non-HTTPS context)
		}
	}
</script>

<Button onclick={share} class="gap-2 min-button bg-primary-300 hover:bg-primary whitespace-nowrap">
	{#if copied}
		<CheckOutline class="h-4 w-4" />
		{texts.pages.invite.linkCopied}
	{:else}
		<UserAddOutline class="h-4 w-4" />
		{texts.pages.invite.shareButton}
	{/if}
</Button>
