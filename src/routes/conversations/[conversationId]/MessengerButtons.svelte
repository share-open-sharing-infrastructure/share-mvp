<script lang="ts">
	import { texts } from '$lib/texts';
	import { Tooltip } from 'flowbite-svelte';
	import type { User } from '$lib/types/models';
	import telegramLogo from '$lib/images/telegram-logo.svg';
	import signalLogo from '$lib/images/Signal-Logo-White.svg';

	interface Props {
		chatPartner: User;
		currentUser: User;
	}

	let { chatPartner, currentUser }: Props = $props();

	const isUserTrusted = $derived(chatPartner.trusts?.includes(currentUser.id) ?? false);

	const telegramAvailable = $derived(
		chatPartner.telegramUsername &&
			chatPartner.telegramUsername.trim() !== '' &&
			(!chatPartner.telegramVisibleToTrustedOnly || isUserTrusted)
	);
	const telegramHidden = $derived(
		chatPartner.telegramUsername &&
			chatPartner.telegramUsername.trim() !== '' &&
			chatPartner.telegramVisibleToTrustedOnly &&
			!isUserTrusted
	);
	const signalAvailable = $derived(
		chatPartner.signalLink &&
			chatPartner.signalLink.trim() !== '' &&
			(!chatPartner.signalVisibleToTrustedOnly || isUserTrusted)
	);
	const signalHidden = $derived(
		chatPartner.signalLink &&
			chatPartner.signalLink.trim() !== '' &&
			chatPartner.signalVisibleToTrustedOnly &&
			!isUserTrusted
	);

	const telegramLink = $derived(
		telegramAvailable ? `tg:https://t.me/${chatPartner.telegramUsername}` : null
	);
	const signalLink = $derived(signalAvailable ? chatPartner.signalLink : null);

	function handleTelegramClick() {
		if (telegramLink) window.open(telegramLink, '_blank', 'noopener,noreferrer');
	}
	function handleSignalClick() {
		if (signalLink) window.open(signalLink, '_blank', 'noopener,noreferrer');
	}
</script>

{#if telegramAvailable || telegramHidden || signalAvailable || signalHidden}
	<div class="flex gap-2 px-3 py-2 border-b justify-center">
		<!-- Telegram -->
		{#if telegramAvailable}
			<button
				onclick={handleTelegramClick}
				class="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-white bg-[#2CA5E0] hover:bg-[#229ED9] transition-colors"
			>
				<img src={telegramLogo} class="w-4 h-4" alt="Telegram" />
				{texts.messenger.contactViaTelegram}
			</button>
		{:else if telegramHidden}
			<button
				disabled
				class="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed"
			>
				<img src={telegramLogo} class="w-4 h-4 opacity-50" alt="Telegram" />
				{texts.messenger.contactViaTelegram}
			</button>
			<Tooltip type="light" placement="top">{texts.messenger.onlyForTrusted}</Tooltip>
		{/if}

		<!-- Signal -->
		{#if signalAvailable}
			<button
				onclick={handleSignalClick}
				class="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-white bg-[#2C6BED] hover:bg-[#2460D4] transition-colors"
			>
				<img src={signalLogo} class="w-4 h-4" alt="Signal" />
				{texts.messenger.contactViaSignal}
			</button>
		{:else if signalHidden}
			<button
				disabled
				class="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed"
			>
				<img src={signalLogo} class="w-4 h-4 opacity-50" alt="Signal" />
				{texts.messenger.contactViaSignal}
			</button>
			<Tooltip type="light" placement="top">{texts.messenger.onlyForTrusted}</Tooltip>
		{/if}
	</div>
{/if}
