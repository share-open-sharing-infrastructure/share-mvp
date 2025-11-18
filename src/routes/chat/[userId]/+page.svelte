<script lang="ts">
    import PocketBase from 'pocketbase';
	import { enhance } from '$app/forms';
	import { env } from '$env/dynamic/public';

    let pb: PocketBase;
    let { data } = $props(); // Note: remember to never destructure the data object unless you want to loose reactivity
    let lastMessageElement: HTMLDivElement;

    let messages = $state([...data.currentMessages])
    
    // This automatic effect keeps the chat window scrolled down to the last message on new messages
    $effect(() => {
        // Track changes to currentMessages specifically
        if (messages && lastMessageElement) {
            // Use setTimeout to ensure DOM has rendered
            setTimeout(() => {
                lastMessageElement?.scrollIntoView({ behavior: 'smooth' }); // TODO: consider if behavior should be something else but 'smooth'
            }, 0);
        }
    });

    // whenever the server data changes (e.g. switching user), reset local messages to the new server-side messages
    $effect(() => {
        messages = [...data.currentMessages];
    });

    // This effect sets up and tears down PocketBase subscriptions for real-time updates when the chat partner changes.
    // I thought I could do this via onMount/onDestroy but those only run once per component lifetime, not per data change.
    $effect(() => {
        const chatPartnerId = data.currentChatPartnerId;

        console.log('Setup for user', chatPartnerId);

        // Example: set up PB subscription here
        pb = new PocketBase(env.PUBLIC_PB_URL);
        pb.authStore?.loadFromCookie(document.cookie || '')

        const topic = '*';

        pb.collection('messages').subscribe(
            topic, 
            function (e) {
                const msg = e.record;
                // Only process messages relevant to this chat  

                const isInThisChat =
                    (msg.from === data.currentUserId && msg.to === chatPartnerId) ||
                    (msg.to === data.currentUserId && msg.from === chatPartnerId);

                if (!isInThisChat) return;

                if (e.action === 'create') {
                    // append new message
                    messages = [...messages, msg];
                }

                console.log(e.action);
                console.log(e.record);
            }
        );

        // cleanup when:chatPartnerId changes OR component is destroyed
        return () => {
            console.log('Cleanup for user', chatPartnerId);
            pb.collection('messages').unsubscribe('*'); // remove all '*' topic subscriptions
            
            // destroy client when component is destroyed, unclear if this is a better way
            // pb?.authStore?.clear()
        };
    });


</script>

<!-- Display all messages with selected other user -->
<span>Chat mit {data.currentChatPartner.username}</span>
<div class="overflow-auto mb-4 flex flex-col">
    {#each messages as message}
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

