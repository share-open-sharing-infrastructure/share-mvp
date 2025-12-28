<script lang="ts">
	import { UserCircleSolid } from 'flowbite-svelte-icons';
	import Message from './Message.svelte';
	import { enhance } from '$app/forms';
	import { Button, Img, Input, Label } from 'flowbite-svelte';

    let { data } = $props();
   
    let chatPartner = $derived(data.conversation.requester === data.currentUser.id ? data.conversation.itemOwner : data.conversation.requester);
    let messageText: string = $state('');

</script>

<div class="mb-4 flex items-center justify-center gap-1 border-t border-b p-2">
	<div id="icon" class="p-1">
		<Img 
			alt="Requested Item Image"
			class="h-10 w-10 rounded-full object-cover"
			src={`${data.PB_URL}api/files/${data.conversation.requestedItem.collectionId}/${data.conversation.requestedItem.id}/${data.conversation.requestedItem.image}`}
			/>
	</div>
	<div class="text-lg font-semibold text-gray-900">
		{data.conversation.requestedItem.name} von {chatPartner.username}
	</div>
	<UserCircleSolid class="flex h-6 w-6 shrink-0" />
	
</div>

<div class="mb-4 flex flex-col overflow-auto">
	{#each data.conversation.messages as message}
		<Message {message} isFromCurrentUser={data.currentUser?.id} />
	{/each}
</div>

<!-- Input field to type and send new messages -->
<div id="message-input" class="mt-auto flex">
	<form
		class="mt-auto flex w-full items-end gap-2"
		method="POST"
		action="?/sendMessage"
		use:enhance
	>
        <Input name="chatPartnerId" value={chatPartner.id} hidden></Input>
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
