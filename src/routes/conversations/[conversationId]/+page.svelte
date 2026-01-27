<script lang="ts">
	import { MapPinOutline, UserCircleSolid } from 'flowbite-svelte-icons';
	import Message from './Message.svelte';
	import { enhance } from '$app/forms';
	import { Button, Img, Input, Label } from 'flowbite-svelte';
	import placeholderimg from '$lib/images/placeholder_img.png';

    let { data } = $props();
   
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

</script>

<!-- Conversation Header -->
<div class="flex min-h-15 h-15 border-b p-1">
	<div class="flex justify-end h-full min-w-1/2 gap-1 pr-1 truncate">
		<div class="flex flex-col items-end truncate">
			<span class="text-m">{chatPartner.username}</span>
			<span class="text-xs">aktiv seit {formatTimestamp(chatPartner.created)}</span>
		</div>
		<img src={`https://ui-avatars.com/api/?name=${chatPartner.username}&background=random`} class="rounded-[20px] aspect-square object-cover"/>
	</div>
	<div class="flex justify-start h-full min-w-1/2 gap-1 pl-1 truncate ">
		<img src={`${data.PB_URL}api/files/${data.conversation.requestedItem.collectionId}/${data.conversation.requestedItem.id}/${data.conversation.requestedItem.image}`} class="rounded-[20px] aspect-square object-cover"/>
		<div class="flex flex-col items-start">
			<span class="text-m">{data.conversation.requestedItem.name}</span>
			<span class="flex text-xs">
					<MapPinOutline class="h-3 w-3" />{data.conversation.requestedItem.place}</span>
		</div>
	</div>
	
	<!-- <div id="icon" class="p-1">
		<Img
			alt="Requested Item Image"
			class="h-10 w-10 rounded-full object-cover"
			src={`${data.PB_URL}api/files/${data.conversation.requestedItem.collectionId}/${data.conversation.requestedItem.id}/${data.conversation.requestedItem.image}`}
			/>
	</div>
	<div class="text-lg font-semibold text-gray-900">
		{#if loggedInUserIsItemOwner}
			Anfrage für {data.conversation.requestedItem.name} von {chatPartner.username}
		{:else}
			Anfrage für {data.conversation.requestedItem.name} an {chatPartner.username}
		{/if}
	</div>
	<UserCircleSolid class="flex h-6 w-6 shrink-0" /> -->
	
</div>

<!-- Messages list -->
<div class="flex flex-col overflow-auto p-2">
	{#each data.conversation.messages as message}
		<Message {message} isFromCurrentUser={data.currentUser?.id} />
	{/each}
</div>

<!-- Input field to type and send new messages -->
<div id="message-input" class="flex p-2 mt-auto">
	<form
		class="flex w-full items-end gap-2"
		method="POST"
		action="?/sendMessage"
		use:enhance
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
		<Button class="min-button" type="submit">Senden</Button>
	</form>
</div>
