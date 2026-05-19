<script lang="ts">
	// Imports for pocketbase real-time subcription
	import type PocketBase from 'pocketbase';
	import type { RecordSubscription } from 'pocketbase';
	import { onMount, untrack } from 'svelte';
	import { PUBLIC_PB_URL } from '$env/static/public';
	import { getClientPB } from '$lib/client-pb';

	// Other imports
	import { Button, Modal, Input } from 'flowbite-svelte';
	import MessageElement from './MessageElement.svelte';
	import { setupPocketBaseSubscription } from '$lib/utils/utils';
	import type { Conversation, Message } from '$lib/types/models';
	import { texts } from '$lib/texts';
	import ConversationHeader from './ConversationHeader.svelte';
	import MessageForm from './MessageForm.svelte';
	import LendingStatusBar from './LendingStatusBar.svelte';
	import CounterfactualModal from './CounterfactualModal.svelte';

	// Props and state variables
	let { data } = $props();

	// eslint-disable-next-line svelte/prefer-writable-derived -- messages must stay $state; it is also written by the async real-time event handler (using $derived here caused an OOM infinite loop)
	let messages: Message[] = $state(
		// eslint-disable-next-line svelte/no-unused-svelte-ignore
		// svelte-ignore state_referenced_locally
		data.conversation.messages ? [...data.conversation.messages] : []
	);
	// Sync messages when server data refreshes (e.g. after use:enhance reloads load())
	$effect(() => {
		messages = data.conversation.messages ? [...data.conversation.messages] : [];
	});

	// eslint-disable-next-line svelte/prefer-writable-derived -- same pattern as messages: written by the real-time event handler
	let lendingStatus: Conversation['lendingStatus'] = $state(
		// eslint-disable-next-line svelte/no-unused-svelte-ignore
		// svelte-ignore state_referenced_locally
		data.conversation.lendingStatus
	);
	$effect(() => {
		lendingStatus = data.conversation.lendingStatus;
	});

	// eslint-disable-next-line svelte/prefer-writable-derived -- same pattern: written by the real-time event handler
	let counterfactual: Conversation['counterfactual'] = $state(
		// eslint-disable-next-line svelte/no-unused-svelte-ignore
		// svelte-ignore state_referenced_locally
		data.conversation.counterfactual
	);
	$effect(() => {
		counterfactual = data.conversation.counterfactual;
	});

	let loggedInUserIsItemOwner = $derived(
		data.currentUser.id === data.conversation.itemOwner.id
	);
	let chatPartner = $derived(
		loggedInUserIsItemOwner
			? data.conversation.requester
			: data.conversation.itemOwner
	);
	let messageText: string = $state('');

	// UI state variables
	let deleteConversationModal = $state(false);
	let showCounterfactualModal = $derived(counterfactual === 'pending' && !loggedInUserIsItemOwner);
	let isSubmitting: boolean = $state(false);
	let chatWindow: HTMLDivElement;

	// Scroll chat window to bottom when messages change
	$effect(() => {
		if (messages && messages.length > 0 && chatWindow) {
			setTimeout(() => {
				chatWindow.scrollTo({
					top: chatWindow.scrollHeight,
					behavior: 'smooth',
				});
			}, 0);
		}
	});

	// Grab the shared client once mounted.
	// Must be $state so the subscription $effect re-runs when pb is set.
	let pb: PocketBase | undefined = $state();
	onMount(() => {
		pb = getClientPB();
	});

	// Handle incoming real-time message events
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async function handleConversationEvent(event: RecordSubscription<any>) {
		if (!pb) return;
		if (event.action === 'update') {
			// Update lending status if it changed
			if (event.record.lendingStatus !== undefined) {
				lendingStatus = event.record.lendingStatus || undefined;
			}
			if (event.record.counterfactual !== undefined) {
				counterfactual = event.record.counterfactual || undefined;
			}

			// Extract the last message id from the updated conversation record
			const lastMessageId =
				event.record.messages?.[event.record.messages.length - 1];

			// get last messages contents from pocketbase
			let latestMessage: Message;
			if (lastMessageId) {
				try {
					latestMessage = await pb.collection('messages').getOne(lastMessageId);
					// Deduplicate: server reload via use:enhance may have already added this message
					if (!messages.some((m) => m.id === latestMessage.id)) {
						messages = [...messages, latestMessage];
					}
				} catch (error) {
					console.error('Failed to fetch last message record:', error);
				}
			}
		}
	}

	// Set up real-time subscription.
	// data.conversation.id is read with untrack so this $effect only re-runs when pb changes
	// (once, after onMount). Without untrack, invalidateAll() from MessageForm would cause
	// the subscription to tear down and re-subscribe on every message send, which triggers
	// PocketBase's submitSubscriptions and auto-cancels concurrent getList calls in the layout.
	$effect(() => {
		if (!pb) return;
		const id = untrack(() => data.conversation.id);
		const cleanup = setupPocketBaseSubscription(pb, 'conversations', id, handleConversationEvent);
		return cleanup;
	});
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<ConversationHeader
	{chatPartner}
	conversation={data.conversation}
	PB_URL={PUBLIC_PB_URL}
	onDelete={() => (deleteConversationModal = true)}
	{loggedInUserIsItemOwner}
	currentUser={data.currentUser}
/>

<LendingStatusBar
	{lendingStatus}
	isOwner={loggedInUserIsItemOwner}
	itemOwnerUsername={data.conversation.itemOwner.username}
/>

<!-- Messages list -->
<div bind:this={chatWindow} class="flex flex-col flex-1 overflow-auto px-4 py-4 gap-0.5 bg-papier dark:bg-tinte-900">
	{#if lendingStatus === 'pending' && messages.length === 0 && !loggedInUserIsItemOwner}
		<p class="text-xl p-4 text-center max-w-100 mx-auto my-auto text-tinte-400 dark:text-tinte-500 italic">
			{texts.lending.statusDescription.pending.requesterNudge(chatPartner.username, data.conversation.requestedItem.name)}
		</p>
	{/if}
	{#each messages as message (message.id)}
		<MessageElement {message} isFromCurrentUser={data.currentUser?.id} />
	{/each}
</div>

<!-- Input bar -->
<div class="border-t border-tinte-100 dark:border-tinte-800 bg-white dark:bg-tinte-900 px-4 py-3">
	<MessageForm {chatPartner} bind:isSubmitting bind:messageText />
</div>

<CounterfactualModal open={showCounterfactualModal} conversationId={data.conversation.id} />

<Modal title="Anfrage löschen" form bind:open={deleteConversationModal}>
	Willst du diese Anfrage wirklich löschen? Alle Nachrichten dieser Unterhaltung
	gehen dabei verloren.

	<form
		class="flex justify-end ml-2"
		method="POST"
		action="?/deleteConversation"
	>
		<Input name="conversationId" value={data.conversation.id} hidden></Input>
		<Button class="bg-danger min-button" type="submit">Anfrage löschen</Button>
	</form>
</Modal>
