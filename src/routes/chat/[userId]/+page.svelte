<script lang="ts">
	import PocketBase from 'pocketbase';
	import { enhance } from '$app/forms';
    import { PUBLIC_PB_URL } from '$env/static/public';
	import { Button, Input, Label, Toast } from 'flowbite-svelte';
	import { UserCircleSolid } from 'flowbite-svelte-icons';
	import Message from './Message.svelte';
	import { onMount } from 'svelte';
	import type { RecordSubscription } from 'pocketbase';

	let { data, form } = $props();
	let messages = $state([...data.currentMessages]);
	let messageText: string = $state('');
	let lastMessageElement: HTMLDivElement;
	let chatWindow: HTMLDivElement;

	// Initialize PocketBase client once on component mount
	let pb: PocketBase;
	onMount(() => {
		pb = new PocketBase(PUBLIC_PB_URL);
		pb.authStore.loadFromCookie(document.cookie || '');
	});

	// Handle incoming real-time message events
	function handleMessageEvent(event: RecordSubscription<any>) {
		const message = event.record;
		const currentUserId = data.currentUser?.id;
		const chatPartnerId = data.currentChatPartner.id;

		// Only process messages in this conversation
		const isRelevantMessage =
			(message.from === currentUserId && message.to === chatPartnerId) ||
			(message.from === chatPartnerId && message.to === currentUserId);

		if (!isRelevantMessage) return;

		// Only handle new messages (ignore updates/deletes)
		if (event.action === 'create') {
			messages = [...messages, message];
		}
	}

	/**
	 * Sets up a PocketBase real-time subscription for the respective collection and record, and unsubscribes on cleanup.
	 * @param pocketBaseInstance A PocketBase instance to subscribe to
	 * @param collectionName The collection name to subscribe to
	 * @param recordId The record ID to subscribe to, defaults to '*' (all records in the collection)
	 * @param eventHandler A callback function to handle incoming subscription events
	 * TODO: Check if this needs to be done client-side, maybe it's better to do server-side? Would that work?
	 */
	function setupPocketBaseSubscription(
		pocketBaseInstance: PocketBase,
		collectionName: string,
		recordId: string = '*',
		eventHandler: (event: RecordSubscription<any>) => void
	) {
		// Subscribe to all message events
		// Note: PocketBase doesn't support filtering subscriptions by query,
		// so we must subscribe to all messages and filter client-side
		pocketBaseInstance
			?.collection(collectionName)
			.subscribe(recordId, eventHandler)
			.catch((error) => {
				console.error(`Failed to subscribe to ${collectionName}:`, error);
			});

		// Cleanup: unsubscribe when chat partner changes or component unmounts
		return () => {
			pocketBaseInstance
				?.collection(collectionName)
				.unsubscribe(recordId)
				.catch((error) => {
					console.error(`Failed to unsubscribe from ${collectionName}:`, error);
				});
		};
	}

	// Set up real-time subscription
	$effect(() => setupPocketBaseSubscription(pb, 'messages', '*', handleMessageEvent));

	// Scroll chat window to bottom when messages change
	$effect(() => {
		if (messages.length > 0 && chatWindow) {
			setTimeout(() => {
				chatWindow.scrollTo({
					top: chatWindow.scrollHeight,
					behavior: 'smooth'
				});
			}, 0);
		}
	});

	// Sync local messages with server data when messages prop changes
	$effect(() => {
		messages = [...data.currentMessages];
	});
</script>

<!-- Display all messages with selected other user -->

<div class="mb-4 flex items-center justify-center gap-1 border-t border-b p-2">
	<div class="text-lg font-semibold text-gray-900">
		Unterhaltung mit {data.currentChatPartner.username}
	</div>
	<UserCircleSolid class="flex h-6 w-6 shrink-0" />
</div>

<div bind:this={chatWindow} class="mb-4 flex flex-col overflow-auto">
	{#each messages as message}
		<Message {message} isFromCurrentUser={data.currentUser?.id} />
	{/each}
	<!-- dummy element to auto-scroll down to -->
	<div bind:this={lastMessageElement}></div>
</div>

{#if form?.fail}
	<Toast>
		<span class="font-medium">
			{form.message}
		</span>
	</Toast>
{/if}

<!-- Input field to type and send new messages -->
<div id="message-input" class="mt-auto flex">
	<form
		class="mt-auto flex w-full items-end gap-2"
		method="POST"
		action="?/sendMessage"
		use:enhance
	>
		<Label class="w-full">
			<Input
				name="messageContent"
				type="text"
				placeholder="Type your message..."
				class="mt-4 w-full rounded-lg border px-3 py-2"
				required
				autocomplete="off"
				autofocus
				bind:value={messageText}
			/>
		</Label>
		<Button 
			class="min-button bg-primary-400 hover:bg-primary-500 cursor-pointer" 
			type="submit">Senden</Button>
	</form>
</div>
