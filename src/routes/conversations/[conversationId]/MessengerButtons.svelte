<script lang="ts">
	import { texts } from '$lib/texts';
	import { Button, Tooltip } from 'flowbite-svelte';
	import { MessagesOutline, PaperPlaneSolid } from 'flowbite-svelte-icons';
	import type { User } from '$lib/types/models';

	interface Props {
		chatPartner: User;
		currentUser: User;
	}

	let { chatPartner, currentUser }: Props = $props();

	// Determine if current user is trusted
	const isUserTrusted = $derived(
		chatPartner.trusts?.includes(currentUser.id) ?? false
	);

	// Telegram: check if contact is available and permitted
	const telegramAvailable = $derived(
		chatPartner.telegramUsername &&
			chatPartner.telegramUsername.trim() !== '' &&
			(!chatPartner.telegramVisibleToTrustedOnly || isUserTrusted)
	);

	// Telegram: check if hidden due to trust restriction
	const telegramHidden = $derived(
		chatPartner.telegramUsername &&
			chatPartner.telegramUsername.trim() !== '' &&
			chatPartner.telegramVisibleToTrustedOnly &&
			!isUserTrusted
	);

	// Signal: check if contact is available and permitted
	const signalAvailable = $derived(
		chatPartner.signalLink &&
			chatPartner.signalLink.trim() !== '' &&
			(!chatPartner.signalVisibleToTrustedOnly || isUserTrusted)
	);

	// Signal: check if hidden due to trust restriction
	const signalHidden = $derived(
		chatPartner.signalLink &&
			chatPartner.signalLink.trim() !== '' &&
			chatPartner.signalVisibleToTrustedOnly &&
			!isUserTrusted
	);

	// Build Telegram link using t.me (works on web and app)
	const telegramLink = $derived(
		telegramAvailable ? `tg:https://t.me/${chatPartner.telegramUsername}` : null
	);

	// Signal link is already stored
	const signalLink = $derived(signalAvailable ? chatPartner.signalLink : null);

	function handleTelegramClick() {
		if (telegramLink) {
			// Open in new tab to ensure web fallback works if app not installed
			window.open(telegramLink, '_blank', 'noopener,noreferrer');
		}
	}

	function handleSignalClick() {
		if (signalLink) {
			// Open in new tab for Signal as well
			window.open(signalLink, '_blank', 'noopener,noreferrer');
		}
	}
</script>

{#if telegramAvailable || telegramHidden || signalAvailable || signalHidden}
	<div class="flex gap-2 p-2 justify-center mb-2">
		<!-- Telegram Button -->
		{#if telegramAvailable}
			<Button
				color="blue"
				size="sm"
				onclick={handleTelegramClick}
				class="flex items-center gap-2"
			>
				<MessagesOutline class="h-4 w-4" />
				{texts.messenger.contactViaTelegram}
			</Button>
		{:else if telegramHidden}
			<Button
				disabled
				color="gray"
				size="sm"
				class="flex items-center gap-2 opacity-50 cursor-not-allowed"
			>
				<MessagesOutline class="h-4 w-4" />
				{texts.messenger.contactViaTelegram}
			</Button>
			<Tooltip type="light" placement="top">
				{texts.messenger.onlyForTrusted}
			</Tooltip>
		{/if}

		<!-- Signal Button -->
		{#if signalAvailable}
			<Button
				color="purple"
				size="sm"
				onclick={handleSignalClick}
				class="flex items-center gap-2"
			>
				<PaperPlaneSolid class="h-4 w-4" />
				{texts.messenger.contactViaSignal}
			</Button>
		{:else if signalHidden}
			<Button
				disabled
				color="gray"
				size="sm"
				class="flex items-center gap-2 opacity-50 cursor-not-allowed"
			>
				<PaperPlaneSolid class="h-4 w-4" />
				{texts.messenger.contactViaSignal}
			</Button>
			<Tooltip type="light" placement="top">
				{texts.messenger.onlyForTrusted}
			</Tooltip>
		{/if}
	</div>
{/if}
