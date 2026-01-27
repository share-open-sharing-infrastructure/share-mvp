<script lang="ts">
    import placeholderimg from '$lib/images/placeholder_img.png';
    let { conversation, currentUser, PB_IMG_URL } = $props();
</script>

<li class="w-full border mb-2 rounded-[20px] hover:bg-yellow-100 truncate">
    <a href={`/conversations/${conversation.id}`} class="flex items-center justify-between p-1">
        <div class="flex flex-col w-full">
            <div class="w-full font-sm text-center mb-1">
                {conversation.expand.requestedItem.name}
            </div>
            <div class="flex w-full">
                <div class="p-1 max-w-1/2 flex items-center justify-center">
                    <div class="flex items-center justify-center w-full">
                        {#if conversation.requester === currentUser.id} <!-- User requests from another -->
                            <img 
                                class="w-full rounded-[20px] aspect-square object-cover" 
                                src={`https://ui-avatars.com/api/?name=DU&background=B6FFAB`}
                                alt="Profile picture of {currentUser.username}" 
                                />
                        {:else} <!-- Another user requests from this user -->
                            <img 
                                class="w-full rounded-[20px] aspect-square object-cover" 
                                src={`https://ui-avatars.com/api/?name=${conversation.expand.requester.username}&background=random&format=svg`}
                                alt="Profile picture of {conversation.expand.requester.username}" 
                                />
                        {/if}
                    </div>
                </div>
                <div class="p-1 max-w-1/2 flex items-center justify-center">
                    <div class="flex items-center justify-center w-full">
                        <img 
                            class="w-full rounded-[20px] aspect-square object-cover" 
                            src={`${PB_IMG_URL}api/files/${conversation.expand.requestedItem.collectionId}/${conversation.expand.requestedItem.id}/${conversation.expand.requestedItem.image}`}
                            alt="The requested item"/>
                            <!-- src={`${PB_IMG_URL}api/files/${conversation.expand.requestedItem.collectionId}/${conversation.expand.requestedItem.id}/${conversation.expand.requestedItem.image}`}  -->
                    </div>
                </div>
            </div>
        </div>
    </a>
</li>