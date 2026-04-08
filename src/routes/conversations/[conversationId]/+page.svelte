<script lang="ts">
	// Imports for pocketbase real-time subcription
	import PocketBase from 'pocketbase';
	import type { RecordSubscription } from 'pocketbase';
	import { onMount } from 'svelte';
	import { PUBLIC_PB_URL } from '$env/static/public';

	// Other imports
	import { Button, Modal, Input } from 'flowbite-svelte';
	import MessageElement from './MessageElement.svelte';
	import { setupPocketBaseSubscription } from '$lib/utils/utils';
	import type { Message } from '$lib/types/models';
	import ConversationHeader from './ConversationHeader.svelte';
	import MessageForm from './MessageForm.svelte';
	import MessengerButtons from './MessengerButtons.svelte';

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

	// Initialize PocketBase client once on component mount
	// Must be $state so the subscription $effect re-runs when pb is set
	let pb: PocketBase | undefined = $state();
	onMount(() => {
		pb = new PocketBase(PUBLIC_PB_URL);
		pb.authStore.loadFromCookie(document.cookie || '');
	});

	// Handle incoming real-time message events
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async function handleConversationEvent(event: RecordSubscription<any>) {
		if (!pb) return;
		if (event.action === 'update') {
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

	// Sync local messages with server data when messages prop changes
	// Set up real-time subscription
	$effect(() => {
		if (!pb) return; // Wait for pb to be initialized
		const cleanup = setupPocketBaseSubscription(
			pb,
			'conversations',
			data.conversation.id,
			handleConversationEvent
		);
		return cleanup;
	});
</script>

<ConversationHeader
	{chatPartner}
	conversation={data.conversation}
	PB_URL={PUBLIC_PB_URL}
	onDelete={() => (deleteConversationModal = true)}
	{loggedInUserIsItemOwner}
/>

<!-- Messenger Contact Buttons -->
<MessengerButtons {chatPartner} currentUser={data.currentUser} />

<!-- Messages list -->
<div bind:this={chatWindow} class="flex flex-col flex-1 overflow-auto p-3 gap-0.5">
	{#each messages as message (message.id)}
		<MessageElement {message} isFromCurrentUser={data.currentUser?.id} />
	{/each}
</div>

<!-- Input bar -->
<div class="border-t p-3">
	<MessageForm {chatPartner} bind:isSubmitting bind:messageText />
</div>

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
