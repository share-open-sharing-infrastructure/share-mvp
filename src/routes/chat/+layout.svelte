<script lang="ts">
    import { Section } from 'flowbite-svelte-blocks';
    import { List, Li } from "flowbite-svelte";
	import { UserCircleSolid } from 'flowbite-svelte-icons';
    const { data, children } = $props();
</script>

<Section>
    <div class="flex items-center justify-center m-2">
		<span class="text-2xl font-semibold text-gray-900 dark:text-white"> Chats </span>
	</div>

    <div class="flex flex-col items-center justify-center">
        
        <!-- Main chat window container including chat list and messages -->
        <div id="chat-window-container" class="flex w-full max-w-4xl flex-col h-120">

            <!-- Contains both the chat list and the messages window -->
            <!-- TODO: Pull down into the per-user route? -->
            <div id="chat-container" class="flex overflow-hidden" >
                <!-- List of all users the present user chatted with -->
                <div id="chat-list" class="w-1/3 p-4 border-r overflow-auto">
                    <List class="list-none">
                        {#each data.chatPartners as chatPartner}
                            <Li>
                                <a
                                href="/chat/{chatPartner.id}"
                                class="flex border-t block p-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <div class="p-1">
                                        <UserCircleSolid class="shrink-0 h-6 w-6" />
                                    </div>
                                    <div class="p-1 overflow-hidden">
                                        {chatPartner.username}
                                    </div>     
                                </a>
                            </Li>
                        {/each}
                    </List>
                </div>

                <!-- Chat window showing messages and input field -->
                <div id="chat-window" class="w-2/3 p-4 flex flex-col">
                    {@render children()}
                </div>
            </div>
        </div>
    </div>
</Section>