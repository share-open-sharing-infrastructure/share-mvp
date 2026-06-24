<script lang="ts">
	import { browser } from '$app/environment';
	import { texts } from '$lib/texts';
	import { Button } from 'flowbite-svelte';
	import { UserAddOutline, CheckOutline } from 'flowbite-svelte-icons';

	let {
		inviteUrl,
		username = '',
		shareText: customShareText,
		label
	}: { inviteUrl: string; username?: string; shareText?: string; label?: string } = $props();

	let copied = $state(false);

	// Prefer the native Web Share API (available on mobile and some desktop browsers)
	// so the user can pick any app (WhatsApp, Signal, …). Falls back to clipboard copy
	// on browsers that don't support navigator.share (most desktop browsers).
	async function share() {
		const shareText = customShareText ?? texts.pages.invite.shareText(username);
		if (browser && navigator.share) {
			try {
				await navigator.share({ title: 'AllerLeih', text: shareText, url: inviteUrl });
			} catch {
				// user cancelled the native share sheet — do nothing
			}
			return;
		}

		// Clipboard fallback: prepend the invite text so the paste is ready-to-send
		try {
			await navigator.clipboard.writeText(shareText + inviteUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// clipboard unavailable in non-HTTPS or sandboxed contexts
		}
	}
</script>

<Button onclick={share} class="gap-2 min-button w-full bg-primary-300 hover:bg-primary whitespace-nowrap">
	{#if copied}
		<CheckOutline class="h-4 w-4" />
		{texts.pages.invite.linkCopied}
	{:else}
		<UserAddOutline class="h-4 w-4" />
		{label ?? texts.pages.invite.shareButton}
	{/if}
</Button>
