<script lang="ts">
	// Imports for pocketbase real-time subcription
	import PocketBase from 'pocketbase';
	import type { RecordSubscription } from 'pocketbase';
	import { onMount } from 'svelte';
	import { PUBLIC_PB_URL } from '$env/static/public';
	
	import { MapPinOutline, PaperPlaneSolid, TrashBinSolid } from 'flowbite-svelte-icons';
	import { Button, Modal, Input, Label } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import MessageElement from './MessageElement.svelte';
	import type { Message } from '$lib/types/models';

	let defaultModal = $state(false);
	let isSubmitting: boolean = $state(false);
	let chatWindow: HTMLDivElement;

	let { data } = $props();
	let messages = $state(data.conversation.messages ? [...data.conversation.messages] : []);

	let loggedInUserIsItemOwner = $derived(data.currentUser.id === data.conversation.itemOwner.id);
	let chatPartner = $derived(loggedInUserIsItemOwner ? data.conversation.requester : data.conversation.itemOwner);
	let messageText: string = $state('');

	function formatTimestamp(timestamp: string) {
		const d = new Date(timestamp);
		const day = d.getDate();
		const month = d.getMonth() + 1; // months are 0-based
		const year = d.getFullYear();
		const hours = d.getHours();
		const minutes = d.getMinutes();

		// pad single digits (e.g. 3 → 03)
		const pad = (n: number) => String(n).padStart(2, '0');

		// if today, return only time
		const today = new Date();
		if (d.toDateString() === today.toDateString()) {
			return `${pad(hours)}:${pad(minutes)}`;
		}

		return `${pad(day)}.${pad(month)}.${pad(year)}`;
	}

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
					latestMessage = await pb.collection('messages').getOne(lastMessageId)
				} catch (error) {
					console.error('Failed to fetch last message record:', error);
				}
			}

			messages = [...messages, latestMessage];
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
		// Subscribe to some collection's and record's events
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

	// Sync local messages with server data when messages prop changes
	$effect(() => {
		messages = data.conversation.messages ? [...data.conversation.messages] : [];
	});

	// Set up real-time subscription
	$effect(() => {
		if (!pb) return; // Wait for pb to be initialized
        const cleanup = setupPocketBaseSubscription(pb, 'conversations', data.conversation.id, handleConversationEvent);
        return cleanup;
	});
</script>

<!-- Conversation Header -->
<div class="flex min-h-15 h-15 border-b p-1">
	<div class="flex justify-end h-full min-w-1/2 gap-1 pr-1 truncate">
		<div class="flex flex-col items-end truncate">
			<span class="text-m">{chatPartner.username}</span>
			<span class="text-xs">aktiv seit {formatTimestamp(chatPartner.created)}</span>
		</div>
		<img
			src={`https://ui-avatars.com/api/?name=${chatPartner.username}&background=random`}
			class="rounded-[20px] aspect-square object-cover"
			alt="User Avatar"
		/>
	</div>
	<div class="flex justify-start h-full min-w-1/2 gap-1 pl-1 truncate">
		<img
			src={`${data.PB_URL}api/files/${data.conversation.requestedItem.collectionId}/${data.conversation.requestedItem.id}/${data.conversation.requestedItem.image}`}
			class="rounded-[20px] aspect-square object-cover"
			alt="User Avatar"
		/>
		<div class="flex flex-col items-start">
			<span class="text-m">{data.conversation.requestedItem.name}</span>
			<span class="flex text-xs">
				<MapPinOutline class="h-3 w-3" />{data.conversation.requestedItem.place}</span
			>
		</div>
	</div>
</div>

<!-- Messages list -->
<div bind:this={chatWindow} class="flex flex-col overflow-auto p-2">
	{#each messages as message}
		<MessageElement {message} isFromCurrentUser={data.currentUser?.id} />
	{/each}
</div>

<!-- Input field to type and send new messages -->
<div id="message-input" class="flex p-2 mt-auto">
	<form
		class="flex w-full items-end gap-2"
		method="POST"
		action="?/sendMessage"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ update }) => {
				await update();
				isSubmitting = false;
				messageText = '';
			};
		}}
	>
		<Button class="bg-red-700 border rounded-[20px]" onclick={() => (defaultModal = true)}
			><TrashBinSolid class="shrink-0 h-full" /></Button
		>
		<Input name="chatPartnerId" value={chatPartner.id} hidden></Input>
		<Label class="w-full ">
			<Input
				name="messageContent"
				type="text"
				placeholder="Tippe deine Nachricht..."
				class="w-full search-bar"
				required
				autocomplete="off"
				autofocus
				bind:value={messageText}
			/>
		</Label>
		<Button class="min-button" type="submit" disabled={isSubmitting}
			><PaperPlaneSolid class="shrink-0 h-full" /></Button
		>
	</form>
</div>

<Modal title="Anfrage löschen" form bind:open={defaultModal}>
	Willst du diese Anfrage wirklich löschen? Alle Nachrichten dieser Unterhaltung gehen dabei
	verloren.

	<form class="flex justify-end ml-2" method="POST" action="?/deleteConversation">
		<Input name="conversationId" value={data.conversation.id} hidden></Input>
		<Button class="bg-red-700 rounded-[20px]" type="submit">Anfrage löschen</Button>
	</form>
</Modal>
