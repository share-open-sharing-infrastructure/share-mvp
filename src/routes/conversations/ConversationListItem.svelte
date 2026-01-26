<script lang="ts">
	import { Img } from "flowbite-svelte";
	import { ArrowRightAltSolid, QuestionCircleSolid } from "flowbite-svelte-icons";
    import placeholderimg from '$lib/images/placeholder_img.png';


    let { conversation, currentUser, PB_IMG_URL } = $props();

</script>

<li class="border mb-2 rounded hover:bg-yellow-100">
    <a href={`/conversations/${conversation.id}`} class="flex items-center justify-between p-1">
        <div class="p-1 min-w-2/4 flex items-center justify-center">
                <div class="flex flex-col items-center justify-center w-full">
                    {#if conversation.requester === currentUser.id} <!-- User requests from another -->
                        <img 
                            class="w-full rounded-lg aspect-square object-cover" 
                            src={`https://ui-avatars.com/api/?name=DU&background=random`}
                            alt="Profile picture of {currentUser.username}" 
                            />
                        <div class="w-full truncate text-ellipsis text-xs">Du</div>
                    {:else} <!-- Another user requests from this user -->
                        <img 
                            class="w-full rounded-lg" 
                            src={`https://ui-avatars.com/api/?name=${conversation.expand.requester.username}&background=random`}
                            alt="Profile picture of {conversation.expand.requester.username}" 
                            />
                        <div class="w-full truncate text-ellipsis text-xs">{conversation.expand.requester.username}</div>
                    {/if}
                </div>
            </div>
        <div class=" 
            p-1
            min-w-2/4
            flex items-center justify-center
            ">
                <div class="flex flex-col items-center justify-center w-full">
                    <img class="w-full rounded-lg aspect-square object-cover" src={`${PB_IMG_URL}api/files/${conversation.expand.requestedItem.collectionId}/${conversation.expand.requestedItem.id}/${conversation.expand.requestedItem.image}`} alt="Item image" />
                    <div class="w-full truncate text-xs">{conversation.expand.requestedItem.name}</div>
                </div>
        </div>
    </a>
</li>