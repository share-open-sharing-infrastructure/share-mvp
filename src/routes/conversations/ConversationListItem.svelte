<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';

	let { conversation, currentUser, PB_IMG_URL } = $props();

	const isActive = $derived($page.params.conversationId === conversation.id);

	const otherUser = $derived(
		conversation.requester === currentUser.id
			? conversation.expand.itemOwner
			: conversation.expand.requester
	);

	const isUnread = $derived(
		conversation.itemOwner === currentUser.id
			? !conversation.readByOwner
			: !conversation.readByRequester
	);

	const itemImage = $derived(
		conversation.expand.requestedItem.image
			? `${PB_IMG_URL}api/files/${conversation.expand.requestedItem.collectionId}/${conversation.expand.requestedItem.id}/${conversation.expand.requestedItem.image}`
			: null
	);
</script>

<li class="w-full">
	<a
		href={resolve(`/conversations/${conversation.id}`)}
		class="flex items-center gap-2.5 rounded-xl p-2 transition-colors
			{isActive
			? 'border border-accent dark:bg-amber-900/20'
			: 'hover:bg-gray-50 dark:hover:bg-gray-800'}"
	>
		<!-- Item thumbnail -->
		<div class="shrink-0 w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
			{#if itemImage}
				<img
					src={itemImage}
					alt={conversation.expand.requestedItem.name}
					class="w-full h-full object-cover"
				/>
			{:else}
				<div class="w-full h-full flex items-center justify-center text-gray-400 text-lg">□</div>
			{/if}
		</div>

		<!-- Text -->
		<div class="flex-1 min-w-0">
			<p class="text-sm font-medium truncate text-gray-900 dark:text-white leading-tight">
				{conversation.expand.requestedItem.name}
			</p>
			<p class="text-xs text-gray-500 dark:text-gray-400 truncate leading-tight">
				@{otherUser.username}
			</p>
		</div>

		<!-- Unread dot -->
		{#if isUnread}
			<div class="shrink-0 w-2 h-2 rounded-full bg-blue-500"></div>
		{/if}
	</a>
</li>
