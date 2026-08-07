<script lang="ts">
	// Imports for pocketbase real-time subcription
	import type PocketBase from 'pocketbase';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { getClientPB } from '$lib/client-pb';
	import { realtimeSynced } from '$lib/stores/realtimeSynced.svelte';
	import { subscribeConversation } from './conversationRealtime';
	import { stickToBottom } from './chatScroll';
	import { startPresenceHeartbeat } from './presenceHeartbeat';

	// Other imports
	import MessageElement from './MessageElement.svelte';
	import { displayName } from '$lib/utils/utils';
	import { ABORTABLE_LENDING_STATES, isLendingStatusIn } from '$lib/lending';
	import { texts } from '$lib/texts';
	import ConversationHeader from './ConversationHeader.svelte';
	import MessageForm from './MessageForm.svelte';
	import LendingStatusBar from './LendingStatusBar.svelte';
	import CounterfactualModal from './CounterfactualModal.svelte';
	import ConfirmActionModal from './ConfirmActionModal.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';

	// Props and state variables
	let { data } = $props();

	// Server-load data that the realtime event handler also writes to. `realtimeSynced`
	// re-syncs from load() (e.g. after a use:enhance reload) while staying directly
	// writable by the subscription handler below (issue #469).
	const messages = realtimeSynced(() =>
		data.conversation.messages ? [...data.conversation.messages] : []
	);
	const lendingStatus = realtimeSynced(() => data.conversation.lendingStatus);
	const counterfactual = realtimeSynced(() => data.conversation.counterfactual);

	let loggedInUserIsItemOwner = $derived(
		data.currentUser.id === data.conversation.itemOwner.id
	);
	let conversationId = $derived(data.conversation.id);
	let chatPartner = $derived(
		loggedInUserIsItemOwner
			? data.conversation.requester
			: data.conversation.itemOwner
	);

	// UI state variables
	let deleteConversationModal = $state(false);
	let abortRequestModal = $state(false);

	// #373 decision 1: while a request is abortable (pending/accepted) the Delete
	// affordance is replaced by "Anfrage abbrechen". Delete is available ONLY in the
	// terminal lending states (rejected/completed/aborted, to clear history) and for
	// plain chats with no lending status at all. It stays hidden for pending/accepted
	// (abortable) AND for active/return_requested (a loan in progress).
	const isAbortable = $derived(isLendingStatusIn(ABORTABLE_LENDING_STATES, lendingStatus.value));
	const isLoanInProgress = $derived(
		lendingStatus.value === 'active' || lendingStatus.value === 'return_requested'
	);
	const canDelete = $derived(!isAbortable && !isLoanInProgress);
	let showCounterfactualModal = $derived(
		counterfactual.value === 'pending' && !loggedInUserIsItemOwner
	);

	// Grab the shared client once mounted.
	// Must be $state so the subscription $effect re-runs when pb is set.
	let pb: PocketBase | undefined = $state();
	onMount(() => {
		pb = getClientPB();
	});

	// Set up real-time subscription. The merge/refetch/dedupe logic lives in the
	// co-located conversationRealtime helper (issue #469).
	// Uses the $derived conversationId so the subscription re-targets when navigating
	// between conversations, but does NOT re-subscribe on invalidateAll() (same id).
	$effect(() => {
		if (!pb) return;
		return subscribeConversation(
			pb,
			conversationId,
			{
				getMessages: () => messages.value,
				setMessages: (next) => (messages.value = next),
				setLendingStatus: (s) => (lendingStatus.value = s),
				setCounterfactual: (c) => (counterfactual.value = c),
			},
			// Messages sent while the stream was down (e.g. the phone was asleep)
			// aren't replayed by realtime — refetch the conversation on reconnect
			// so the missing messages appear. Fixes the "doesn't update for one
			// party" symptom in #435.
			() => invalidateAll(),
			// The 15 s presence ping below (conversations.update on lastSeenAt) is
			// echoed back over SSE, so a healthy stream delivers an event at least
			// every ~15 s while this chat is open. That lets the client-pb watchdog
			// treat a longer silence as a silently frozen connection and reconnect (#528).
			true
		);
	});

	// Presence heartbeat: periodically update the lastSeenAt timestamp so the backend
	// knows the user is actively viewing this conversation and can suppress email
	// notifications. See presenceHeartbeat.ts for the cadence/field-name/SSE-watchdog
	// contract this must preserve.
	$effect(() => {
		if (!pb) return;
		const field = loggedInUserIsItemOwner ? 'ownerLastSeenAt' : 'requesterLastSeenAt';
		return startPresenceHeartbeat(pb, conversationId, field);
	});
</script>

<SeoHead title={texts.seo.conversations.title} robots="noindex, nofollow" />

<ConversationHeader
	{chatPartner}
	conversation={data.conversation}
	onDelete={canDelete ? () => (deleteConversationModal = true) : undefined}
	{loggedInUserIsItemOwner}
	partnerContact={data.partnerContact}
/>

<LendingStatusBar
	lendingStatus={lendingStatus.value}
	isOwner={loggedInUserIsItemOwner}
	itemOwnerUsername={displayName(data.conversation.itemOwner)}
	onAbort={() => (abortRequestModal = true)}
/>

<!-- Messages list -->
<div
	use:stickToBottom={messages.value}
	class="flex flex-col flex-1 overflow-auto px-4 py-4 gap-0.5 bg-papier dark:bg-tinte-900"
>
	{#if lendingStatus.value === 'pending' && messages.value.length === 0 && !loggedInUserIsItemOwner}
		<p
			class="text-xl p-4 text-center max-w-100 mx-auto my-auto text-tinte-400 dark:text-tinte-500 italic"
		>
			{texts.lending.statusDescription.pending.requesterNudge(
				displayName(chatPartner),
				data.conversation.requestedItem?.name ?? texts.ui.itemUnavailable
			)}
		</p>
	{/if}
	{#each messages.value as message (message.id)}
		<MessageElement {message} isSent={message.from === data.currentUser?.id} />
	{/each}
</div>

<!-- Input bar -->
<div
	class="border-t border-tinte-100 dark:border-tinte-800 bg-white dark:bg-tinte-900 px-4 py-3"
>
	<MessageForm />
</div>

<CounterfactualModal open={showCounterfactualModal} />

<ConfirmActionModal
	bind:open={deleteConversationModal}
	title={texts.lending.confirmDelete.title}
	body={texts.lending.confirmDelete.body}
	confirmLabel={texts.lending.confirmDelete.confirm}
	action="?/deleteConversation"
/>

<ConfirmActionModal
	bind:open={abortRequestModal}
	title={texts.lending.confirmAbort.title}
	body={texts.lending.confirmAbort.body}
	confirmLabel={texts.lending.confirmAbort.confirm}
	action="?/abortRequest"
	onConfirm={() => (abortRequestModal = false)}
/>
