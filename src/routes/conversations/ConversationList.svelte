<script lang="ts">
	import ConversationListItem from './ConversationListItem.svelte';
	import type { Conversation, User } from '$lib/types/models.js';

	let { conversations, currentUser, PB_IMG_URL } = $props();
</script>

<div class="w-1/4 border rounded-[20px] overflow-hidden">
	<div
		class="flex justify-center font-bold text-lg items-center h-15 truncate border-b"
	>
		Unterhaltungen
	</div>
	<ul id="chat-list" class="w-full p-2 overflow-auto h-full">
		{#each conversations as conversation}
			<ConversationListItem {conversation} {currentUser} {PB_IMG_URL} />
		{/each}
	</ul>
</div>
