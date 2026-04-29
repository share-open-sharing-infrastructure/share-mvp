<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { conversation, currentUser, PB_IMG_URL, activeTab } = $props();

	const isActive = $derived(page.params.conversationId === conversation.id);

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
		class="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-all min-h-14
			{isActive
				? 'bg-white dark:bg-tinte-800 shadow-sm'
				: isUnread
					? activeTab === 'borrowing'
						? 'bg-primary-100 dark:bg-primary-900/20 hover:bg-primary-200/60'
						: 'bg-accent-100 dark:bg-accent-900/20 hover:bg-accent-200/60'
					: 'hover:bg-white dark:hover:bg-tinte-800 hover:shadow-sm'}"
	>
		<!-- Item thumbnail -->
		<div class="shrink-0 w-11 h-11 rounded-xl overflow-hidden bg-tinte-200 dark:bg-tinte-700">
			{#if itemImage}
				<img
					src={itemImage}
					alt={conversation.expand.requestedItem.name}
					class="w-full h-full object-cover"
				/>
			{:else}
				<div class="w-full h-full bg-tinte-200 dark:bg-tinte-600"></div>
			{/if}
		</div>

		<!-- Text -->
		<div class="flex-1 min-w-0">
			<p class="text-sm truncate leading-tight
				{isActive
					? activeTab === 'borrowing'
						? 'font-semibold text-primary'
						: 'font-semibold text-accent'
					: isUnread
						? 'font-semibold text-tinte-900 dark:text-white'
						: 'font-medium text-tinte-700 dark:text-tinte-200'}">
				{conversation.expand.requestedItem.name}
			</p>
			<p class="text-xs text-tinte-400 dark:text-tinte-500 truncate leading-tight mt-0.5">
				@{otherUser.username}
			</p>
		</div>

		<!-- Unread dot -->
		{#if isUnread}
			<div class="shrink-0 w-2 h-2 rounded-full
				{activeTab === 'borrowing' ? 'bg-primary' : 'bg-accent'}">
			</div>
		{/if}
	</a>
</li>
