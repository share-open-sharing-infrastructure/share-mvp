<script lang="ts">
	import { Button, Tooltip, Input } from 'flowbite-svelte';
	import { MessagesOutline } from 'flowbite-svelte-icons';
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';
	import { buildMailtoHref, buildItemRedirectHref } from '$lib/utils/utils';
	import type { ItemPublic, UnmetRequirement } from '$lib/types/models';

	interface Props {
		item: ItemPublic;
		isExternal: boolean;
		isOwnItem: boolean;
		isTrustRestricted: boolean;
		isArchived: boolean;
		existingConversation: { id: string; lendingStatus: string } | null;
		requiresTermsAcceptance?: boolean;
		unmetRequirements?: UnmetRequirement[];
		/** Issue #438: when the owner opted into off-platform contact, the request CTA
		 *  becomes a mailto: (method 'email') or an external link (method 'link') instead
		 *  of starting the in-app flow. Null = normal in-app request flow. */
		ownerContact?: { method: 'email' | 'link'; target: string } | null;
	}

	const {
		item,
		isExternal,
		isOwnItem,
		isTrustRestricted,
		isArchived,
		existingConversation,
		requiresTermsAcceptance = false,
		unmetRequirements = [],
		ownerContact = null,
	}: Props = $props();

	// Resolve the off-platform contact CTA target: a prefilled mailto: for email, or the
	// owner's external link routed through /api/redirect (https-guarded + click-tracked,
	// same as external-item CTAs).
	const contactHref = $derived.by(() => {
		if (!ownerContact) return '';
		if (ownerContact.method === 'email') {
			const itemName = item.name ?? texts.pages.itemDetail.unknownItem;
			return buildMailtoHref(
				ownerContact.target,
				texts.pages.itemDetail.mailtoSubject(itemName),
				texts.pages.itemDetail.mailtoBody(itemName),
			);
		}
		return buildItemRedirectHref(ownerContact.target, item.id);
	});

	const hasUnmetRequirements = $derived(unmetRequirements.length > 0 && !existingConversation);
</script>

<div class="flex items-center gap-3">
	{#if isExternal}
		<!-- External item: deep-link CTA -->
		<!-- Status badge lives near the page title; only the hint for unknown status is shown here -->
		{#if item.status === 'unknown'}
			<span class="text-sm text-tinte-500 dark:text-tinte-400">
				{texts.institutional.availabilityHintExternal}
			</span>
		{/if}
		{#if !isArchived && item.externalUrl}
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={buildItemRedirectHref(item.externalUrl, item.id)}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold bg-primary-200 hover:bg-primary text-tinte-900 transition-colors"
			>
				{texts.institutional.externalLendCta(item.username ?? '')}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
	{:else if isOwnItem}
		<!-- Own item: status toggle -->
		<form method="POST" action="?/toggleStatus" use:enhance>
			<button
				type="submit"
				class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold border transition-colors cursor-pointer
					{item.status === 'available'
						? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
						: item.status === 'unavailable'
						? 'bg-accent-100 text-accent-800 border-accent-300 hover:bg-accent-200'
						: 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'}"
			>
				{item.status === 'available'
					? texts.itemStatus.available
					: item.status === 'unavailable'
					? texts.itemStatus.unavailable
					: texts.itemStatus.unknown}
				{#if item.status !== 'unknown'}
					<span class="ml-2 text-xs opacity-60">
						{'→ ' + (item.status === 'available' ? texts.itemStatus.markUnavailable : texts.itemStatus.markAvailable)}
					</span>
				{/if}
			</button>
		</form>
	{:else if item.status === 'unknown'}
		<!-- Status is shown near the title; nothing actionable to display here -->
	{:else if isTrustRestricted}
		<!-- Disabled buttons suppress pointer events, so the tooltip must be anchored
		     to the surrounding span instead of the button itself. -->
		<span id="anfragen-disabled" class="cursor-not-allowed">
			<Button pill disabled class="min-button bg-primary-200 hover:bg-primary opacity-50 pointer-events-none">
				<MessagesOutline class="h-4 w-4 mr-2" />
				{texts.pages.itemDetail.requestButton}
			</Button>
		</span>
		<Tooltip triggeredBy="#anfragen-disabled" type="light" placement="top" trigger="click">
			{texts.pages.itemDetail.trustRestrictedTooltip}
		</Tooltip>
	{:else if existingConversation}
		<!-- An in-progress conversation exists (incl. when the owner uses email contact):
		     link straight into it rather than offering a new request / mailto. -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={resolve(`/conversations/${existingConversation.id}`)} class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold bg-primary-200 hover:bg-primary text-tinte-900 transition-colors">
			<MessagesOutline class="h-4 w-4 mr-2" />
			{texts.lending.goToConversation}
		</a>
	{:else if ownerContact}
		<!-- Owner opted into off-platform contact (#438): same "Anfragen" button, but it
		     opens a prefilled mailto: (email) or links to the owner's external form (link)
		     instead of starting the in-app request flow. The link opens in a new tab and
		     is routed through /api/redirect (https guard + click tracking). -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href={contactHref}
			target={ownerContact.method === 'link' ? '_blank' : undefined}
			rel={ownerContact.method === 'link' ? 'noopener noreferrer' : undefined}
			class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold bg-primary-200 hover:bg-primary text-tinte-900 transition-colors"
		>
			<MessagesOutline class="h-4 w-4 mr-2" />
			{texts.pages.itemDetail.requestButton}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{:else if hasUnmetRequirements}
		<!-- Lender requirements not met (#423/#389): requesting is disabled; we offer
		     the missing steps as quick-fix buttons (same style as the request button). -->
		<div class="flex flex-col items-end gap-2">
			<p class="text-sm text-tinte-600 dark:text-tinte-400">{texts.lendingRequirements.blockedIntro}</p>
			<div class="flex flex-wrap justify-end gap-2">
				{#each unmetRequirements as req (req.key)}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={req.actionHref} class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold bg-primary-200 hover:bg-primary text-tinte-900 transition-colors">
						{req.actionLabel} →
					</a>
				{/each}
			</div>
		</div>
	{:else if requiresTermsAcceptance}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={resolve(`/items/${item.id}/terms`)} class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold bg-primary-200 hover:bg-primary text-tinte-900 transition-colors">
			<MessagesOutline class="h-4 w-4 mr-2" />
			{texts.pages.itemDetail.requestButton}
		</a>
	{:else}
		<form method="POST" action="?/startConversation" use:enhance>
			<Input name="itemId" value={item.id} hidden />
			<Button pill type="submit" class="cursor-pointer min-button bg-primary-200 hover:bg-primary">
				<MessagesOutline class="h-4 w-4 mr-2" />
				{texts.pages.itemDetail.requestButton}
			</Button>
		</form>
	{/if}
</div>
