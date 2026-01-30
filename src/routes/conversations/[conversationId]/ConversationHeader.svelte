<script lang="ts">
	import { formatTimestamp } from '$lib/utils/utils';
	import { MapPinOutline } from 'flowbite-svelte-icons';

	let { chatPartner, conversation, PB_URL } = $props();
</script>

<div class="flex min-h-15 h-15 border-b p-1">
	<div class="flex justify-end h-full min-w-1/2 gap-1 pr-1 truncate">
		<div class="flex flex-col items-end truncate">
			<span class="text-m">{chatPartner.username}</span>
			<span class="text-xs">aktiv seit {formatTimestamp(chatPartner.created, true)}</span>
		</div>
		<img
			src={`https://ui-avatars.com/api/?name=${chatPartner.username}&background=random`}
			class="rounded-[20px] aspect-square object-cover"
			alt="User Avatar"
		/>
	</div>
	<div class="flex justify-start h-full min-w-1/2 gap-1 pl-1 truncate">
		<img
			src={`${PB_URL}api/files/${conversation.requestedItem.collectionId}/${conversation.requestedItem.id}/${conversation.requestedItem.image}`}
			class="rounded-[20px] aspect-square object-cover"
			alt="User Avatar"
		/>
		<div class="flex flex-col items-start">
			<span class="text-m">{conversation.requestedItem.name}</span>
			<span class="flex text-xs">
				<MapPinOutline class="h-3 w-3" />{conversation.requestedItem.place}</span
			>
		</div>
	</div>
</div>
