<script lang="ts">
	import { enhance } from '$app/forms';

    let { data } = $props(); // Note: remember to never destructure the data object unless you want to loose reactivity
    let lastMessageElement: HTMLDivElement;
    
    // This automatic effect keeps the chat window scrolled down to the last message on new messages
    $effect(() => {
        // Track changes to currentMessages specifically
        if (data.currentMessages && lastMessageElement) {
            // Use setTimeout to ensure DOM has rendered
            setTimeout(() => {
                lastMessageElement?.scrollIntoView({ behavior: 'smooth' });
            }, 0);
        }
    });
</script>

<!-- Display all messages with selected other user -->
<div class="overflow-auto mb-4 flex flex-col">
    {#each data.currentMessages as message}
        <div class="
            {message.from === data.currentUserId ? 'self-end' : 'self-start'}
            border rounded 
            p-1 mt-1
            max-w-1/2 break-words
            text-sm">
            {message.messageContent}
        </div>
    {/each}
    <div bind:this={lastMessageElement}></div>
</div>

<!-- Input field to type and send new messages -->
<div id="message-input" class="mt-auto flex">
<form class="mt-auto flex items-end gap-2 w-full" method="POST" action="?/sendMessage" use:enhance>
    <label class="w-full">
        <input
            name="messageContent"
            type="text"
            placeholder="Type your message..."
            class="w-full border rounded-lg px-3 py-2 mt-4"
            required
            autocomplete="off"
        />
    </label>
    <button type="submit" class="px-4 py-2 border rounded-lg">Senden</button>
</form>
</div>

