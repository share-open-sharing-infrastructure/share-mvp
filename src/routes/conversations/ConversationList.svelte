<script lang="ts">
	import { texts } from '$lib/texts';
	import ConversationListItem from './ConversationListItem.svelte';

	let { activeTab, lendingConversations, borrowingConversations, currentUser, PB_IMG_URL } =
		$props();

	const visibleConversations = $derived(
		activeTab === 'lending' ? lendingConversations : borrowingConversations
	);
</script>

<div class="flex w-1/4 flex-col border rounded-2xl overflow-hidden">
	<ul class="flex-1 overflow-auto p-2 flex flex-col gap-1">
		{#if visibleConversations.length === 0}
			<li class="p-3 text-xs text-gray-400 text-center">
				{activeTab === 'lending'
					? texts.pages.conversations.noLendingConversations
					: texts.pages.conversations.noBorrowingConversations}
			</li>
		{:else}
			{#each visibleConversations as conversation (conversation.id)}
				<ConversationListItem {conversation} {currentUser} {PB_IMG_URL} />
			{/each}
		{/if}
	</ul>
</div>
