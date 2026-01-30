<script lang="ts">
	// Imports for pocketbase real-time subcription
	import PocketBase from 'pocketbase';
	import type { RecordSubscription } from 'pocketbase';
	import { onMount } from 'svelte';
	import { PUBLIC_PB_URL } from '$env/static/public';

	// Other imports
	import { TrashBinSolid } from 'flowbite-svelte-icons';
	import { Button, Modal, Input } from 'flowbite-svelte';
	import MessageElement from './MessageElement.svelte';
	import { setupPocketBaseSubscription } from '$lib/utils/utils';
	import type { Message } from '$lib/types/models';
	import ConversationHeader from './ConversationHeader.svelte';
	import MessageForm from './MessageForm.svelte';

	// Props and state variables
	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let messages = $state(data.conversation.messages ? [...data.conversation.messages] : []);
	let loggedInUserIsItemOwner = $derived(data.currentUser.id === data.conversation.itemOwner.id);
	let chatPartner = $derived(
		loggedInUserIsItemOwner ? data.conversation.requester : data.conversation.itemOwner
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
					behavior: 'smooth'
				});
			}, 0);
		}
	});

	// Initialize PocketBase client once on component mount
	let pb: PocketBase;
	onMount(() => {
		pb = new PocketBase(PUBLIC_PB_URL);
		pb.authStore.loadFromCookie(document.cookie || '');
	});

	// Handle incoming real-time message events
	async function handleConversationEvent(event: RecordSubscription<any>) {
		if (event.action === 'update') {
			// Extract the last message id from the updated conversation record
			const lastMessageId = event.record.messages?.[event.record.messages.length - 1];

			// get last messages contents from pocketbase
			let latestMessage: Message | null = null;
			if (lastMessageId) {
				try {
					latestMessage = await pb.collection('messages').getOne(lastMessageId);
				} catch (error) {
					console.error('Failed to fetch last message record:', error);
				}
			}

			// Append the latest message to local messages array
			messages = [...messages, latestMessage];
		}
	}

	// Sync local messages with server data when messages prop changes
	$effect(() => {
		messages = data.conversation.messages ? [...data.conversation.messages] : [];
	});

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

<ConversationHeader {chatPartner} conversation={data.conversation} PB_URL={PUBLIC_PB_URL} />

<!-- Messages list -->
<div bind:this={chatWindow} class="flex flex-col overflow-auto p-2">
	{#each messages as message}
		<MessageElement {message} isFromCurrentUser={data.currentUser?.id} />
	{/each}
</div>

<!-- Input field to type and send new messages -->
<div id="message-input" class="flex p-2 mt-auto gap-2">
	<Button
		class="bg-red-700 border-black rounded-[20px]"
		onclick={() => (deleteConversationModal = true)}
		><TrashBinSolid class="shrink-0 h-full" /></Button
	>

	<MessageForm {chatPartner} bind:isSubmitting bind:messageText />
</div>

<Modal title="Anfrage löschen" form bind:open={deleteConversationModal}>
	Willst du diese Anfrage wirklich löschen? Alle Nachrichten dieser Unterhaltung gehen dabei
	verloren.

	<form class="flex justify-end ml-2" method="POST" action="?/deleteConversation">
		<Input name="conversationId" value={data.conversation.id} hidden></Input>
		<Button class="bg-red-700 rounded-[20px]" type="submit">Anfrage löschen</Button>
	</form>
</Modal>
