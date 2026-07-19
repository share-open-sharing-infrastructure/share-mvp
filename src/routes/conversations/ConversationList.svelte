<script lang="ts">
	import { texts } from '$lib/texts';
	import ConversationListItem from './ConversationListItem.svelte';

	let { conversations, emptyReason, currentUser, PB_IMG_URL } = $props();

	const emptyText = $derived(
		{
			active: texts.pages.conversations.noActiveConversations,
			lending: texts.pages.conversations.noLendingConversations,
			borrowing: texts.pages.conversations.noBorrowingConversations,
			none: texts.pages.conversations.noConversations,
		}[emptyReason as 'active' | 'lending' | 'borrowing' | 'none']
	);
</script>

<div class="flex-1 min-h-0 overflow-hidden flex flex-col">
	<ul class="flex-1 overflow-auto px-2 pb-2 flex flex-col gap-0.5">
		{#if conversations.length === 0}
			<li class="px-3 py-8 text-xs text-tinte-400 dark:text-tinte-500 text-center">
				{emptyText}
			</li>
		{:else}
			{#each conversations as conversation (conversation.id)}
				<ConversationListItem {conversation} {currentUser} {PB_IMG_URL} />
			{/each}
		{/if}
	</ul>
</div>
