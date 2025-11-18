<script lang="ts">
    import { Section } from 'flowbite-svelte-blocks';
    const { data, children } = $props();
</script>

<Section>
    <div class="flex flex-col items-center justify-center">
        
        <!-- Main chat window container including chat list and messages -->
        <div id="chat-window-container" class="flex w-full max-w-6xl flex-col max-h-120">

            <!-- This contains the headings of the two chat columns -->
            <div id="chat-headlines-container" class="flex">
                <div class="w-1/3 px-4 py-3">
                    <h3 class="font-semibold text-gray-900 dark:text-white">Chats</h3>
                </div>
                <div class="w-2/3 px-4 py-3">
                    <h3 class="font-semibold text-gray-900 dark:text-white">Chat</h3>
                </div>
            </div>

            <!-- Contains both the chat list and the messages window -->
            <!-- TODO: Pull down into the per-user route? -->
            <div id="chat-container" class="flex overflow-hidden" >

                <!-- List of all users the present user chatted with -->
                <div id="chat-list" class="w-1/3 p-4 border-r overflow-auto">
                    <ul>
                        {#each data.chatPartners as chatPartner}
                            <li class="mb-2">
                                <a 
                                href="/chat/{chatPartner.id}"
                                class="block border p-2 rounded hover:bg-gray-100 w-full">
                                    {chatPartner.username}
                                </a>
                            </li>
                        {/each}
                    </ul>
                </div>

                <!-- Chat window showing messages and input field -->
                <div id="chat-window" class="w-2/3 p-4 flex flex-col">
                    {@render children()}
                </div>
            </div>
        </div>
    </div>
</Section>