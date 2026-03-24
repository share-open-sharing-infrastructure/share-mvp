<script lang="ts">
	import { texts } from '$lib/texts';
	import { formatTimestamp } from '$lib/utils/utils';
	import { MapPinOutline, TrashBinSolid } from 'flowbite-svelte-icons';

	let { chatPartner, conversation, PB_URL, onDelete } = $props();
</script>

<div class="flex items-center gap-3 px-3 py-2 border-b min-h-14">
	<!-- Item info (left) -->
	<img
		src={`${PB_URL}api/files/${conversation.requestedItem.collectionId}/${conversation.requestedItem.id}/${conversation.requestedItem.image}`}
		class="w-10 h-10 rounded-xl object-cover shrink-0"
		alt={conversation.requestedItem.name}
	/>
	<div class="flex flex-col min-w-0">
		<span class="text-sm font-semibold truncate">{conversation.requestedItem.name}</span>
		<span class="flex items-center gap-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
			<MapPinOutline class="w-3 h-3 shrink-0" />{conversation.requestedItem.place}
		</span>
	</div>

	<!-- Chat partner info + delete (right) -->
	<div class="ml-auto flex items-center gap-2 shrink-0">
		<div class="flex flex-col items-end">
			<span class="text-sm font-medium">{chatPartner.username}</span>
			<span class="text-xs text-gray-500 dark:text-gray-400">
				{texts.ui.activeSince(formatTimestamp(chatPartner.created, true))}
			</span>
		</div>
		<img
			src={`https://ui-avatars.com/api/?name=${chatPartner.username}&background=random`}
			class="w-9 h-9 rounded-xl object-cover shrink-0"
			alt="Avatar"
		/>
		{#if onDelete}
			<button
				onclick={onDelete}
				class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
				aria-label="Anfrage löschen"
			>
				<TrashBinSolid class="w-4 h-4" />
			</button>
		{/if}
	</div>
</div>
