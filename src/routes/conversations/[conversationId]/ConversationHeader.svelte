<script lang="ts">
	import { texts } from '$lib/texts';
	import { formatTimestamp } from '$lib/utils/utils';
	import { MapPinOutline, TrashBinSolid, ChevronLeftOutline } from 'flowbite-svelte-icons';
	import { Tooltip } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import VerifiedIcon from '$lib/components/VerifiedIcon.svelte';
	import type { User, Conversation } from '$lib/types/models';
	import telegramLogo from '$lib/images/telegram-logo.svg';
	import signalLogo from '$lib/images/Signal-Logo-White.svg';

	let { chatPartner, conversation, PB_URL, onDelete, loggedInUserIsItemOwner = false, currentUser } : {
		chatPartner: User;
		conversation: Conversation;
		PB_URL: string;
		onDelete?: () => void;
		loggedInUserIsItemOwner?: boolean;
		currentUser: User;
	} = $props();

	const isUserTrusted = $derived(chatPartner.trusts?.includes(currentUser.id) ?? false);

	const telegramAvailable = $derived(
		!!(chatPartner.telegramUsername &&
			chatPartner.telegramUsername.trim() !== '' &&
			(!chatPartner.telegramVisibleToTrustedOnly || isUserTrusted))
	);
	const telegramHidden = $derived(
		!!(chatPartner.telegramUsername &&
			chatPartner.telegramUsername.trim() !== '' &&
			chatPartner.telegramVisibleToTrustedOnly &&
			!isUserTrusted)
	);
	const signalAvailable = $derived(
		!!(chatPartner.signalLink &&
			chatPartner.signalLink.trim() !== '' &&
			(!chatPartner.signalVisibleToTrustedOnly || isUserTrusted))
	);
	const signalHidden = $derived(
		!!(chatPartner.signalLink &&
			chatPartner.signalLink.trim() !== '' &&
			chatPartner.signalVisibleToTrustedOnly &&
			!isUserTrusted)
	);

	const telegramLink = $derived(telegramAvailable ? `https://t.me/${chatPartner.telegramUsername}` : null);
	const signalLink = $derived(signalAvailable ? chatPartner.signalLink : null);

	const showMessengerSection = $derived(telegramAvailable || telegramHidden || signalAvailable || signalHidden);
</script>

<div class="flex items-center gap-3 px-4 py-3 border-b border-tinte-100 dark:border-tinte-800 bg-white dark:bg-tinte-900 shrink-0 min-h-15">
	<!-- Back button (mobile only) -->
	<a
		href="/conversations"
		class="md:hidden p-1.5 rounded-lg text-gray-500 hover:text-gray-800 transition-colors shrink-0"
		aria-label="Zurück"
	>
		<ChevronLeftOutline class="w-5 h-5" />
	</a>

	<!-- Item info (left) -->
	<a
		href={resolve('/items/[id]', { id: conversation.requestedItem.id })}
		class="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
	>
		<img
			src={`${PB_URL}api/files/${conversation.requestedItem.collectionId}/${conversation.requestedItem.id}/${conversation.requestedItem.image}`}
			class="w-10 h-10 rounded-xl object-cover shrink-0"
			alt={conversation.requestedItem.name}
		/>
		<div class="flex flex-col min-w-0">
			<span class="text-sm font-semibold truncate">{conversation.requestedItem.name}</span>
			<!-- Location: hidden on mobile -->
			<span class="hidden md:flex items-center gap-0.5 text-xs text-tinte-500 dark:text-tinte-400 truncate">
				<MapPinOutline class="w-3 h-3 shrink-0" />{conversation.requestedItem.place}
			</span>
			<!-- Status badge: hidden on mobile -->
			<div class="hidden md:block">
				{#if loggedInUserIsItemOwner}
					<form method="POST" action="?/toggleStatus" use:enhance class="w-fit">
						<input type="hidden" name="itemId" value={conversation.requestedItem.id} />
						<button
							type="submit"
							class="mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border transition-colors cursor-pointer
								{conversation.requestedItem.status === 'available'
									? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
									: 'bg-accent-100 text-accent-800 border-accent-300 hover:bg-accent-200'}"
						>
							{conversation.requestedItem.status === 'available'
								? texts.itemStatus.available
								: texts.itemStatus.unavailable}
						</button>
					</form>
				{:else}
					<span
						class="mt-0.5 self-start inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border
							{conversation.requestedItem.status === 'available'
								? 'bg-green-100 text-green-800 border-green-300'
								: 'bg-accent-100 text-accent-800 border-accent-300'}"
					>
						{conversation.requestedItem.status === 'available'
							? texts.itemStatus.available
							: texts.itemStatus.unavailable}
					</span>
				{/if}
			</div>
		</div>
	</a>

	<!-- Right side: messenger icons + chat partner + delete -->
	<div class="ml-auto flex items-center gap-2 shrink-0">
		<!-- Messenger contact icon buttons -->
		{#if showMessengerSection}
			<div class="flex items-center gap-1.5">
				<!-- Telegram -->
				{#if telegramAvailable}
					<button
						onclick={() => window.open(telegramLink!, '_blank', 'noopener,noreferrer')}
						class="w-7 h-7 rounded-full bg-[#2CA5E0] hover:bg-[#229ED9] flex items-center justify-center transition-colors shrink-0"
						aria-label={texts.messenger.contactViaTelegram}
					>
						<img src={telegramLogo} class="w-3.5 h-3.5" alt="Telegram" />
					</button>
					<Tooltip type="light" placement="bottom" trigger="click">{texts.messenger.telegram}</Tooltip>
				{:else if telegramHidden}
					<!-- Disabled buttons suppress pointer events, preventing tooltip attachment.
					     The span acts as the tooltip target while the button stays non-interactive. -->
					<span id="tg-hidden-{chatPartner.id}" class="cursor-not-allowed">
						<button
							disabled
							class="w-7 h-7 rounded-full bg-tinte-100 dark:bg-tinte-800 flex items-center justify-center opacity-40 cursor-not-allowed shrink-0 pointer-events-none"
							aria-label={texts.messenger.telegram}
						>
							<img src={telegramLogo} class="w-3.5 h-3.5 opacity-50" alt="Telegram" />
						</button>
					</span>
					<Tooltip triggeredBy="#tg-hidden-{chatPartner.id}" type="light" placement="bottom" trigger="click">{texts.messenger.onlyForTrusted}</Tooltip>
				{/if}

				<!-- Signal -->
				{#if signalAvailable}
					<button
						onclick={() => window.open(signalLink!, '_blank', 'noopener,noreferrer')}
						class="w-7 h-7 rounded-full bg-[#2C6BED] hover:bg-[#2460D4] flex items-center justify-center transition-colors shrink-0"
						aria-label={texts.messenger.contactViaSignal}
					>
						<img src={signalLogo} class="w-3.5 h-3.5" alt="Signal" />
					</button>
					<Tooltip type="light" placement="bottom" trigger="click">{texts.messenger.signal}</Tooltip>
				{:else if signalHidden}
					<!-- Same span-wrapper pattern as Telegram above: disabled button → pointer-events-none, span is the tooltip target. -->
					<span id="sig-hidden-{chatPartner.id}" class="cursor-not-allowed">
						<button
							disabled
							class="w-7 h-7 rounded-full bg-tinte-100 dark:bg-tinte-800 flex items-center justify-center opacity-40 cursor-not-allowed shrink-0 pointer-events-none"
							aria-label={texts.messenger.signal}
						>
							<img src={signalLogo} class="w-3.5 h-3.5 opacity-50" alt="Signal" />
						</button>
					</span>
					<Tooltip triggeredBy="#sig-hidden-{chatPartner.id}" type="light" placement="bottom" trigger="click">{texts.messenger.onlyForTrusted}</Tooltip>
				{/if}
			</div>
		{/if}

		<!-- Chat partner -->
		<a
			href={resolve('/users/[id]', { id: chatPartner.id })}
			class="flex items-center gap-2 hover:opacity-80 transition-opacity"
		>
			<div class="hidden md:flex flex-col items-end">
				<span class="text-sm font-medium">{chatPartner.username}</span>
				<span class="text-xs text-tinte-500 dark:text-tinte-400">
					{texts.ui.activeSince(formatTimestamp(chatPartner.created, true))}
				</span>
			</div>
			<div class="relative shrink-0">
				<img
					src={`https://ui-avatars.com/api/?name=${chatPartner.username}&background=random`}
					class="w-9 h-9 rounded-xl object-cover"
					alt="Avatar"
				/>
				{#if chatPartner.verified}
					<VerifiedIcon class="absolute -top-1 -right-1 h-3.5 w-3.5" />
				{/if}
			</div>
		</a>

		<!-- Delete button -->
		{#if onDelete}
			<button
				onclick={onDelete}
				class="p-1.5 rounded-lg text-tinte-400 hover:text-accent-500 hover:bg-accent-50 dark:hover:bg-accent-900 transition-colors"
				aria-label="Anfrage löschen"
			>
				<TrashBinSolid class="w-4 h-4" />
			</button>
		{/if}
	</div>
</div>
