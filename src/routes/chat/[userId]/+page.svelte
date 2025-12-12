<script lang="ts">
	import PocketBase from 'pocketbase';
	import { enhance } from '$app/forms';
	import { env } from '$env/dynamic/public';
	import { Button, Input, Label, Toast } from 'flowbite-svelte';
	import { UserCircleSolid } from 'flowbite-svelte-icons';
	import Message from './Message.svelte';

	let pb: PocketBase;
	let { data, form } = $props(); // Note: remember to never destructure the data object unless you want to loose reactivity
	let lastMessageElement: HTMLDivElement;
	let chatWindow: HTMLDivElement;

	let messages = $state([...data.currentMessages]);

	// This automatic effect keeps the chat window scrolled down to the last message on new messages
	$effect(() => {
		// Track changes to currentMessages specifically
		if (messages && lastMessageElement) {
			// Use setTimeout to ensure DOM has rendered
			setTimeout(() => {
				chatWindow.scrollTo({
					top: chatWindow.scrollHeight,
					behavior: 'smooth'
				});
			}, 0);
		}
	});

	// whenever the server data changes (e.g. switching user), reset local messages to the new server-side messages
	$effect(() => {
		messages = [...data.currentMessages];
	});

	// This effect sets up and tears down PocketBase subscriptions for real-time updates when the chat partner changes.
	$effect(() => {
		const chatPartnerId = data.currentChatPartner.id;

		// set up PB subscription here
		pb = new PocketBase(env.PUBLIC_PB_URL);
		pb.authStore?.loadFromCookie(document.cookie || '');

		// This will eventually cause performance problems because the subscription runs on all messages independent of who they are to/from. 
		// A better solution would be to have per-user channels/conversations or similar server-side filtering. But this would need to be implemented in PocketBase itself.
		const topic = '*'; 

		pb.collection('messages').subscribe(topic, function (e) {
			const message = e.record;

			// Only process messages relevant to this chat
			const isInThisChat =
				(message.from === data.currentUser?.id && message.to === chatPartnerId) ||
				(message.to === data.currentUser?.id && message.from === chatPartnerId);

			if (!isInThisChat) return;

			if (e.action === 'create') {
				// append new message
				messages = [...messages, message];
			}
		});

		// cleanup when:chatPartnerId changes OR component is destroyed
		return () => {
			pb.collection('messages').unsubscribe('*'); // remove all '*' topic subscriptions

			// destroy client when component is destroyed
			// unclear if this is a better way:
			// pb?.authStore?.clear()
		};
	});

	let messageText: string = $state('');
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
	<div bind:this={lastMessageElement}></div> <!-- dummy element to auto-scroll down to -->
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
		<Button type="submit">Senden</Button>
	</form>
</div>
