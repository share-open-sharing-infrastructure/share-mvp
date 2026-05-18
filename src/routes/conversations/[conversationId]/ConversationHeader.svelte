<script lang="ts">
	import { texts } from '$lib/texts';
	import { formatTimestamp } from '$lib/utils/utils';
	import { TrashBinSolid, ChevronLeftOutline } from 'flowbite-svelte-icons';
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
	const signalLink = $derived(signalAvailable ? (chatPartner.signalLink ?? null) : null);

	const showMessengerSection = $derived(telegramAvailable || telegramHidden || signalAvailable || signalHidden);

	const chatPartnerAvatarUrl = $derived(
		chatPartner.profileImage
			? `${PB_URL}api/files/users/${chatPartner.id}/${chatPartner.profileImage}`
			: `https://ui-avatars.com/api/?name=${encodeURIComponent(chatPartner.username)}&background=random`
	);
</script>

{#snippet messengerBtn(href: string | null, available: boolean, hidden: boolean, logo: string, activeColors: string, label: string, logoSize: string)}
	{#if available || hidden}
		<button
			disabled={!available}
			onclick={available ? () => window.open(`/api/redirect?to=${encodeURIComponent(href!)}&source=conversation&item=${conversation.requestedItem.id}`, '_blank', 'noopener,noreferrer') : undefined}
			class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 {available ? `${activeColors} transition-colors cursor-pointer` : 'bg-tinte-100 dark:bg-tinte-800 opacity-40 cursor-not-allowed'}"
			aria-label={label}
		>
			<img src={logo} class="{logoSize} {available ? '' : 'opacity-50'}" alt={label} />
		</button>
		<Tooltip type="light" placement="bottom">{available ? `Auf ${label} schreiben` : texts.messenger.onlyForTrusted}</Tooltip>
	{/if}
{/snippet}

<div class="flex items-center gap-3 px-4 py-3 border-b border-tinte-100 dark:border-tinte-800 bg-white dark:bg-tinte-900 shrink-0 min-h-15">
	<!-- Back button (mobile only) -->
	<a
		href={resolve('/conversations')}
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
			class="w-10 h-10 rounded-full object-cover shrink-0"
			alt={conversation.requestedItem.name}
		/>
		<div class="flex flex-col min-w-0">
			<span class="text-sm font-semibold truncate">{conversation.requestedItem.name}</span>

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
				{@render messengerBtn(telegramLink, telegramAvailable, telegramHidden, telegramLogo, 'bg-[#2CA5E0] hover:bg-[#229ED9]', texts.messenger.telegram, 'w-5 h-5')}
				{@render messengerBtn(signalLink, signalAvailable, signalHidden, signalLogo, 'bg-[#2C6BED] hover:bg-[#2460D4]', texts.messenger.signal, 'w-3.5 h-3.5')}
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
					src={chatPartnerAvatarUrl}
					class="w-9 h-9 rounded-full border object-cover"
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
