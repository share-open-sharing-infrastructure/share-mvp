<script lang="ts">
    import PocketBase from 'pocketbase';
	import { enhance } from '$app/forms';
	import { env } from '$env/dynamic/public';
    import { Button, Input, Label, Toast } from 'flowbite-svelte';
	import { UserCircleSolid } from 'flowbite-svelte-icons';

    let pb: PocketBase;
    let { data, form } = $props(); // Note: remember to never destructure the data object unless you want to loose reactivity
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
        const chatPartnerId = data.currentChatPartner.id;

        // set up PB subscription here
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
            }
        );

        // cleanup when:chatPartnerId changes OR component is destroyed
        return () => {
            pb.collection('messages').unsubscribe('*'); // remove all '*' topic subscriptions
            
            // destroy client when component is destroyed
            // unclear if this is a better way:
            // pb?.authStore?.clear()
        };
    });

    let messageText: string = $state('');

    function formatTimestamp(ts: string) {
        const d = new Date(ts);
        const day = d.getDate();
        const month = d.getMonth() + 1;  // months are 0-based
        const hours = d.getHours();
        const minutes = d.getMinutes();

        // pad single digits (e.g. 3 → 03)
        const pad = (n: number) => String(n).padStart(2, '0');

        // if today, return only time
        const today = new Date();
        if (d.toDateString() === today.toDateString()) {
            return `${pad(hours)}:${pad(minutes)}`;
        }

        return `${pad(day)}.${pad(month)}. ${pad(hours)}:${pad(minutes)}`;
    }

</script>

<!-- Display all messages with selected other user -->

<div class="flex items-center gap-1 justify-center border-b border-t p-2 mb-4">
    <div class="flex text-lg font-semibold text-gray-900 dark:text-white">
        Unterhaltung mit {data.currentChatPartner.username}
    </div>
    <UserCircleSolid class="flex shrink-0 h-6 w-6"/>
</div>

<div class="overflow-auto mb-4 flex flex-col">
    {#each messages as message}
        <div class="
            {message.from === data.currentUserId ? 'self-end' : 'self-start'}
            border rounded 
            p-1 px-2 mt-1
            max-w-2/3 break-words
            text-sm">
            {message.messageContent}
            <div class="text-xs text-gray-500 text-right">
                {formatTimestamp(message.created)}
            </div>
        </div>
    {/each}
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
    <form class="mt-auto flex items-end gap-2 w-full" method="POST" action="?/sendMessage" 
        use:enhance
        >
        <Label class="w-full">
            <Input
                name="messageContent"
                type="text"
                placeholder="Type your message..."
                class="w-full border rounded-lg px-3 py-2 mt-4"
                required
                autocomplete="off"
                autofocus
                bind:value={messageText}
            />
        </Label>
        <Button type="submit">
            Senden
        </Button>
    </form>
</div>