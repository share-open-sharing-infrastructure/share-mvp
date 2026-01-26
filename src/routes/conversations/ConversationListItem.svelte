<script lang="ts">
	import { Img } from "flowbite-svelte";

    let { conversation, currentUser, PB_IMG_URL } = $props();

</script>

<li
    class="
	border-t
	p-2
	hover:bg-orange-50"
>
	<a href={`/conversations/${conversation.id}`} class="flex">
		<div id="icon" class="p-1">
            <Img 
                alt="Requested Item Image"
                class="h-10 w-10 rounded-full object-cover"
                src={`${PB_IMG_URL}api/files/${conversation.expand.requestedItem.collectionId}/${conversation.expand.requestedItem.id}/${conversation.expand.requestedItem.image}`}
                />
		</div>
		<div id="username" class="overflow-hidden p-1 text-ellipsis text-sm">
            {conversation.expand.requestedItem.name}
            ({#if conversation.requester === currentUser.id}
                an {conversation.expand.itemOwner.username}
            {:else} 
                von {conversation.expand.requester.username}
            {/if})
		</div>
	</a>
</li>