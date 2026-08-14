<script lang="ts">
	import { texts } from '$lib/texts';
	import { itemStatusBadgeClasses, itemStatusLabel } from '$lib/utils/itemStatus';
	import { formatTimestamp, displayName, itemOwnFileUrls, buildItemRedirectHref } from '$lib/utils/utils';
	import { pbUrl } from '$lib/publicEnv';
	import { TrashBinSolid, ChevronLeftOutline } from 'flowbite-svelte-icons';
	import { Tooltip } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import VerifiedIcon from '$lib/components/VerifiedIcon.svelte';
	import InitialsAvatar from '$lib/components/InitialsAvatar.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { ConversationPartner } from '$lib/types/models';
	import type { ConversationDetail } from './conversationDetail';
	import telegramLogo from '$lib/images/telegram-logo.svg';
	import signalLogo from '$lib/images/Signal-Logo-White.svg';

	let { chatPartner, conversation, onDelete, loggedInUserIsItemOwner = false, partnerContact } : {
		chatPartner: ConversationPartner;
		conversation: ConversationDetail;
		onDelete?: () => void;
		loggedInUserIsItemOwner?: boolean;
		partnerContact: { telegramUsername: string | null; telegramHidden: boolean; signalLink: string | null; signalHidden: boolean };
	} = $props();

	// Visibility (trusted-only handling) is resolved server-side by the /api/contact
	// hook; here we just render what the partner is allowed to see.
	const telegramAvailable = $derived(!!partnerContact?.telegramUsername);
	const telegramHidden = $derived(!!partnerContact?.telegramHidden);
	const signalAvailable = $derived(!!partnerContact?.signalLink);
	const signalHidden = $derived(!!partnerContact?.signalHidden);

	const telegramLink = $derived(telegramAvailable ? `https://t.me/${partnerContact.telegramUsername}` : null);
	const signalLink = $derived(signalAvailable ? partnerContact.signalLink : null);

	const showMessengerSection = $derived(telegramAvailable || telegramHidden || signalAvailable || signalHidden);

	const chatPartnerName = $derived(displayName(chatPartner));

	// The requested item can go dangling (deleted/inaccessible) while the conversation
	// persists — every read below falls back to a safe placeholder instead of crashing.
	const item = $derived(conversation.requestedItem);
	const itemName = $derived(item?.name ?? texts.ui.itemUnavailable);
	const itemRedirectItemId = $derived(item?.id ?? '');

	const requestedItemCoverUrl = $derived(item ? (itemOwnFileUrls(pbUrl(), item)[0] ?? null) : null);

	const chatPartnerAvatarUrl = $derived(
		chatPartner.profileImage ? `${pbUrl()}api/files/users/${chatPartner.id}/${chatPartner.profileImage}` : null
	);
</script>

{#snippet messengerBtn({ href, available, hidden, logo, activeColors, label, logoSize }: {
	href: string | null;
	available: boolean;
	hidden: boolean;
	logo: string;
	activeColors: string;
	label: string;
	logoSize: string;
})}
	{#if available || hidden}
		{#if available}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- buildItemRedirectHref() returns an already-resolved URL; the rule cannot see through the call -->
			<a
				href={buildItemRedirectHref(href!, itemRedirectItemId, 'conversation')}
				target="_blank"
				rel="noopener noreferrer"
				class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 {activeColors} transition-colors cursor-pointer"
				aria-label={label}
			>
				<img src={logo} class={logoSize} alt={label} />
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{:else}
			<span
				class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-tinte-100 dark:bg-tinte-800 opacity-40 cursor-not-allowed"
				aria-label={label}
			>
				<img src={logo} class="{logoSize} opacity-50" alt={label} />
			</span>
		{/if}
		<Tooltip type="light" placement="bottom">{available ? `Auf ${label} schreiben` : texts.messenger.onlyForTrusted}</Tooltip>
	{/if}
{/snippet}

<div class="flex items-center gap-3 px-4 py-3 border-b border-tinte-100 dark:border-tinte-800 bg-white dark:bg-tinte-900 shrink-0 min-h-15">
	<!-- Back button (mobile only) -->
	<Button
		variant="ghost"
		size="icon-sm"
		href={resolve('/conversations')}
		aria-label="Zurück"
		class="md:hidden"
	>
		<ChevronLeftOutline class="w-5 h-5" />
	</Button>

	<!-- Item info (left) -->
	{#if item}
		<a
			href={resolve('/items/[id]', { id: item.id })}
			class="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
		>
			<img
				src={requestedItemCoverUrl ?? ''}
				class="w-10 h-10 rounded-full object-cover shrink-0"
				alt={itemName}
			/>
			<div class="flex flex-col min-w-0">
				<span class="text-sm font-semibold truncate">{itemName}</span>

				<!-- Status badge: hidden on mobile -->
				<div class="hidden md:block">
					{#if loggedInUserIsItemOwner}
						<form method="POST" action="?/toggleStatus" use:enhance class="w-fit">
							<button
								type="submit"
								class="mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border transition-colors cursor-pointer
									{itemStatusBadgeClasses(item.status, { interactive: true })}"
							>
								{itemStatusLabel(item.status)}
							</button>
						</form>
					{:else}
						<span
							class="mt-0.5 self-start inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border
								{itemStatusBadgeClasses(item.status)}"
						>
							{itemStatusLabel(item.status)}
						</span>
					{/if}
				</div>
			</div>
		</a>
	{:else}
		<div class="flex items-center gap-3 min-w-0">
			<div class="w-10 h-10 rounded-full bg-tinte-200 dark:bg-tinte-700 shrink-0"></div>
			<span class="text-sm font-semibold truncate text-tinte-400 dark:text-tinte-500">{itemName}</span>
		</div>
	{/if}

	<!-- Right side: messenger icons + chat partner + delete -->
	<div class="ml-auto flex items-center gap-2 shrink-0">
		<!-- Messenger contact icon buttons -->
		{#if showMessengerSection}
			<div class="flex items-center gap-1.5">
				{@render messengerBtn({
					href: telegramLink,
					available: telegramAvailable,
					hidden: telegramHidden,
					logo: telegramLogo,
					activeColors: 'bg-[#2CA5E0] hover:bg-[#229ED9]',
					label: texts.messenger.telegram,
					logoSize: 'w-5 h-5',
				})}
				{@render messengerBtn({
					href: signalLink,
					available: signalAvailable,
					hidden: signalHidden,
					logo: signalLogo,
					activeColors: 'bg-[#2C6BED] hover:bg-[#2460D4]',
					label: texts.messenger.signal,
					logoSize: 'w-3.5 h-3.5',
				})}
			</div>
		{/if}

		<!-- Chat partner -->
		<a
			href={resolve('/users/[id]', { id: chatPartner.id })}
			class="flex items-center gap-2 hover:opacity-80 transition-opacity"
		>
			<div class="hidden md:flex flex-col items-end">
				<span class="text-sm font-medium">{chatPartnerName}</span>
				<span class="text-xs text-tinte-500 dark:text-tinte-400">
					{texts.ui.activeSince(formatTimestamp(chatPartner.created, true))}
				</span>
			</div>
			<div class="relative shrink-0">
				{#if chatPartnerAvatarUrl}
					<img
						src={chatPartnerAvatarUrl}
						class="w-9 h-9 rounded-full border object-cover"
						alt={chatPartnerName}
					/>
				{:else}
					<InitialsAvatar name={chatPartnerName} class="w-9 h-9 rounded-full border" />
				{/if}
				{#if chatPartner.verified}
					<VerifiedIcon class="absolute -top-1 -right-1 h-3.5 w-3.5" />
				{/if}
			</div>
		</a>

		<!-- Delete button -->
		{#if onDelete}
			<Button variant="ghost" size="icon-sm" onclick={onDelete} aria-label="Anfrage löschen">
				<TrashBinSolid class="w-4 h-4" />
			</Button>
		{/if}
	</div>
</div>
