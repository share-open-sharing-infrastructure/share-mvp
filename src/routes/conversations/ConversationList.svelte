<script lang="ts">
	import { texts } from '$lib/texts';
	import ConversationListItem from './ConversationListItem.svelte';

	let { activeTab, lendingConversations, borrowingConversations, currentUser, PB_IMG_URL } =
		$props();

	const visibleConversations = $derived(
		activeTab === 'lending' ? lendingConversations : borrowingConversations
	);
</script>

<div class="flex-1 min-h-0 overflow-hidden flex flex-col">
	<ul class="flex-1 overflow-auto px-2 pb-2 flex flex-col gap-0.5">
		{#if visibleConversations.length === 0}
			<li class="px-3 py-8 text-xs text-tinte-400 dark:text-tinte-500 text-center">
				{activeTab === 'lending'
					? texts.pages.conversations.noLendingConversations
					: texts.pages.conversations.noBorrowingConversations}
			</li>
		{:else}
			{#each visibleConversations as conversation (conversation.id)}
				<ConversationListItem {conversation} {currentUser} {PB_IMG_URL} {activeTab} />
			{/each}
		{/if}
	</ul>
</div>
