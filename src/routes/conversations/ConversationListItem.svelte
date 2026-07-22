<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { texts } from '$lib/texts';
	import { displayName } from '$lib/utils/utils';
	import type { Conversation } from '$lib/types/models';

	let {
		conversation,
		currentUser,
		PB_IMG_URL,
	}: {
		conversation: Conversation;
		currentUser: { id: string };
		PB_IMG_URL: string;
	} = $props();

	const isActive = $derived(page.params.conversationId === conversation.id);

	// Role of the current user in this specific conversation — since the list now mixes
	// lending and borrowing conversations together, this replaces the old activeTab prop
	// (which used to reflect a single selected tab) for per-item styling.
	const role = $derived(
		conversation.itemOwner === currentUser.id ? 'lending' : 'borrowing'
	);

	const otherUser = $derived(
		conversation.requester === currentUser.id
			? conversation.expand?.itemOwner
			: conversation.expand?.requester
	);

	const isUnread = $derived(
		conversation.itemOwner === currentUser.id
			? !conversation.readByOwner
			: !conversation.readByRequester
	);

	// requestedItem is normally expanded for participants, but guard against a
	// missing item (e.g. deleted) so one bad row can't crash the whole list.
	const item = $derived(conversation.expand?.requestedItem ?? null);
	const itemName = $derived(item?.name ?? texts.ui.itemUnavailable);

	// `image` is a multi-file field; the first entry is the cover.
	const itemCover = $derived(Array.isArray(item?.image) ? item.image[0] : (item?.image ?? null));
	const itemImage = $derived(
		item && itemCover ? `${PB_IMG_URL}api/files/${item.collectionId}/${item.id}/${itemCover}` : null
	);

	const lendingStatusLabel = $derived(
		conversation.lendingStatus
			? texts.lending.statusLabel[conversation.lendingStatus as keyof typeof texts.lending.statusLabel]
			: null
	);
</script>

<li class="w-full">
	<a
		href={resolve('/conversations/[conversationId]', { conversationId: conversation.id })}
		class="flex items-center gap-3 rounded-xl border-l-4 px-2.5 py-2.5 transition-all min-h-14
			{role === 'borrowing' ? 'border-primary' : 'border-accent'}
			{isActive
				? 'bg-white dark:bg-tinte-800 shadow-sm'
				: isUnread
					? role === 'borrowing'
						? 'bg-primary-100 dark:bg-primary-900/20 hover:bg-primary-200/60'
						: 'bg-accent-100 dark:bg-accent-900/20 hover:bg-accent-200/60'
					: 'hover:bg-white dark:hover:bg-tinte-800 hover:shadow-sm'}"
	>
		<!-- Item thumbnail -->
		<div class="shrink-0 w-11 h-11 rounded-full border border-tinte-400 overflow-hidden bg-tinte-200 dark:bg-tinte-700">
			{#if itemImage}
				<img
					src={itemImage}
					alt={itemName}
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
					? role === 'borrowing'
						? 'font-semibold text-primary'
						: 'font-semibold text-accent'
					: isUnread
						? 'font-semibold text-tinte-900 dark:text-white'
						: 'font-medium text-tinte-700 dark:text-tinte-200'}">
				{itemName}
			</p>
			<p class="text-xs text-tinte-400 dark:text-tinte-500 truncate leading-tight mt-0.5">
				{role === 'borrowing'
					? texts.pages.conversations.fromUserPrefix
					: texts.pages.conversations.toUserPrefix} {displayName(otherUser)}
			</p>
			{#if lendingStatusLabel}
				<span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium mt-0.5
					{conversation.lendingStatus === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
					: conversation.lendingStatus === 'rejected' || conversation.lendingStatus === 'aborted' ? 'bg-gray-100 dark:bg-tinte-800 text-tinte-400 dark:text-tinte-500'
					: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'}">
					{lendingStatusLabel}
				</span>
			{/if}
		</div>

		<!-- Unread dot -->
		{#if isUnread}
			<div class="shrink-0 w-2 h-2 rounded-full
				{role === 'borrowing' ? 'bg-primary' : 'bg-accent'}">
			</div>
		{/if}
	</a>
</li>
