<script lang="ts">
	// Imports for pocketbase real-time subcription
	import type PocketBase from 'pocketbase';
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { PUBLIC_PB_URL } from '$env/static/public';
	import { getClientPB } from '$lib/client-pb';
	import { realtimeSynced } from '$lib/stores/realtimeSynced.svelte';
	import { subscribeConversation } from './conversationRealtime';

	// Other imports
	import { Modal, Input } from 'flowbite-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import MessageElement from './MessageElement.svelte';
	import { displayName } from '$lib/utils/utils';
	import { ABORTABLE_LENDING_STATES, isLendingStatusIn } from '$lib/lending';
	import { texts } from '$lib/texts';
	import ConversationHeader from './ConversationHeader.svelte';
	import MessageForm from './MessageForm.svelte';
	import LendingStatusBar from './LendingStatusBar.svelte';
	import CounterfactualModal from './CounterfactualModal.svelte';
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
	let messageText: string = $state('');

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
	let isSubmitting: boolean = $state(false);
	let chatWindow: HTMLDivElement;

	function scrollToBottom(smooth = true) {
		if (!chatWindow) return;
		chatWindow.scrollTo({
			top: chatWindow.scrollHeight,
			behavior: smooth ? 'smooth' : 'auto',
		});
	}

	// Scroll chat window to bottom when messages change
	$effect(() => {
		if (messages.value && messages.value.length > 0 && chatWindow) {
			setTimeout(() => scrollToBottom(true), 0);
		}
	});

	// Grab the shared client once mounted.
	// Must be $state so the subscription $effect re-runs when pb is set.
	let pb: PocketBase | undefined = $state();
	onMount(() => {
		pb = getClientPB();

		// Keep the newest messages in view when the visual viewport changes height — e.g.
		// when the mobile keyboard opens and the layout shrinks the chat container. The
		// container is resized by the layout's own resize handler, which runs in the same
		// event; scrolling synchronously here would target the pre-resize height (a no-op)
		// and leave the latest messages hidden below the raised input bar. Defer with rAF
		// so we scroll after the resize + reflow, then once more after the open/close
		// animation settles.
		// Also re-scroll after the layout's cold-load height correction (push/share link,
		// reload): that correction fires on window `load` / `orientationchange` — not
		// necessarily via a vv resize — so mirror those triggers here to land at the bottom
		// once the container has grown to its settled height.
		const vv = window.visualViewport;
		let settleTimer: ReturnType<typeof setTimeout>;
		const keepAtBottom = () => {
			requestAnimationFrame(() => scrollToBottom(false));
			clearTimeout(settleTimer);
			settleTimer = setTimeout(() => scrollToBottom(false), 150);
		};
		vv?.addEventListener('resize', keepAtBottom);
		window.addEventListener('load', keepAtBottom);
		window.addEventListener('orientationchange', keepAtBottom);
		return () => {
			vv?.removeEventListener('resize', keepAtBottom);
			window.removeEventListener('load', keepAtBottom);
			window.removeEventListener('orientationchange', keepAtBottom);
			clearTimeout(settleTimer);
		};
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

	// Mark the conversation as read once it is actually opened. Read-state is no longer
	// touched in load() because load() runs on hover-preload
	// (data-sveltekit-preload-data="hover"), which would mark threads read on mere hover
	// (issue #412). Fire-and-forget: the POST targets the CURRENT conversation by explicit
	// path so a mid-flight client-side nav can't retarget the wrong thread; on success we
	// invalidateAll() to resync read-state (list dot, nav badge). This effect intentionally
	// reads ONLY `pb` (mounted gate) and `conversationId` — adding other reactive reads
	// would make it re-fire and re-mark.
	$effect(() => {
		if (!pb) return;
		const id = conversationId;
		fetch(`/conversations/${id}?/markRead`, { method: 'POST', body: new FormData() })
			.then(() => invalidateAll())
			.catch(() => {});
	});

	// Presence heartbeat: periodically update the lastSeenAt timestamp so the backend
	// knows the user is actively viewing this conversation and can suppress email notifications.
	$effect(() => {
		if (!pb) return;
		const field = loggedInUserIsItemOwner ? 'ownerLastSeenAt' : 'requesterLastSeenAt';

		const ping = () => {
			if (document.visibilityState !== 'visible') return;
			pb!.collection('conversations').update(conversationId, {
				[field]: new Date().toISOString(),
			}).catch(() => {});
		};

		// Ping immediately on mount, then every 15 seconds
		ping();
		const interval = setInterval(ping, 15_000);
		return () => clearInterval(interval);
	});
</script>

<SeoHead title={texts.seo.conversations.title} robots="noindex, nofollow" />

<ConversationHeader
	{chatPartner}
	conversation={data.conversation}
	PB_URL={PUBLIC_PB_URL}
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
	bind:this={chatWindow}
	class="flex flex-col flex-1 overflow-auto px-4 py-4 gap-0.5 bg-papier dark:bg-tinte-900"
>
	{#if lendingStatus.value === 'pending' && messages.value.length === 0 && !loggedInUserIsItemOwner}
		<p
			class="text-xl p-4 text-center max-w-100 mx-auto my-auto text-tinte-400 dark:text-tinte-500 italic"
		>
			{texts.lending.statusDescription.pending.requesterNudge(
				displayName(chatPartner),
				data.conversation.requestedItem.name
			)}
		</p>
	{/if}
	{#each messages.value as message (message.id)}
		<MessageElement {message} isFromCurrentUser={data.currentUser?.id} />
	{/each}
</div>

<!-- Input bar -->
<div
	class="border-t border-tinte-100 dark:border-tinte-800 bg-white dark:bg-tinte-900 px-4 py-3"
>
	<MessageForm {chatPartner} bind:isSubmitting bind:messageText />
</div>

<CounterfactualModal
	open={showCounterfactualModal}
	conversationId={data.conversation.id}
/>

<Modal title="Anfrage löschen" form bind:open={deleteConversationModal}>
	Willst du diese Anfrage wirklich löschen? Alle Nachrichten dieser Unterhaltung
	gehen dabei verloren.

	<form
		class="flex justify-end ml-2"
		method="POST"
		action="?/deleteConversation"
	>
		<Input name="conversationId" value={data.conversation.id} hidden></Input>
		<Button variant="danger" type="submit">Anfrage löschen</Button>
	</form>
</Modal>

<Modal title={texts.lending.confirmAbort.title} form bind:open={abortRequestModal}>
	{texts.lending.confirmAbort.body}

	<form
		class="flex justify-end gap-2 ml-2"
		method="POST"
		action="?/abortRequest"
		use:enhance={() =>
			async ({ update }) => {
				abortRequestModal = false;
				await update();
			}}
	>
		<Input name="conversationId" value={data.conversation.id} hidden></Input>
		<Button variant="danger" type="submit">{texts.lending.confirmAbort.confirm}</Button>
	</form>
</Modal>
