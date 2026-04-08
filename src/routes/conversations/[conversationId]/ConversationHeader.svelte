<script lang="ts">
	import { texts } from '$lib/texts';
	import { formatTimestamp } from '$lib/utils/utils';
	import { MapPinOutline, TrashBinSolid } from 'flowbite-svelte-icons';
	import { enhance } from '$app/forms';

	let { chatPartner, conversation, PB_URL, onDelete, loggedInUserIsItemOwner = false } = $props();
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
		{#if loggedInUserIsItemOwner}
			<form method="POST" action="?/toggleStatus" use:enhance class="w-fit">
				<input type="hidden" name="itemId" value={conversation.requestedItem.id} />
				<button
					type="submit"
					class="mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border transition-colors cursor-pointer
						{conversation.requestedItem.status === 'available'
							? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
							: 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'}"
				>
					{conversation.requestedItem.status === 'available'
						? texts.itemStatus.available
						: texts.itemStatus.unavailable}
				</button>
			</form>
		{:else}
			<span
				class="mt-0.5 self-start inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border
					{conversation.requestedItem.status === 'available'
						? 'bg-green-100 text-green-800 border-green-300'
						: 'bg-red-100 text-red-800 border-red-300'}"
			>
				{conversation.requestedItem.status === 'available'
					? texts.itemStatus.available
					: texts.itemStatus.unavailable}
			</span>
		{/if}
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
