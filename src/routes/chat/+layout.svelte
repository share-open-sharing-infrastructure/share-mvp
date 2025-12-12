<script lang="ts">
	import ChatPartnerListItem from './ChatPartnerListItem.svelte';
	const { data, children } = $props();
</script>

<div class="m-2 flex flex-col items-center justify-center">
	<h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Chats</h1>

	<!-- Main chat window container including chat list and messages -->
	<div id="chat-container" class="flex h-120 w-full max-w-3xl justify-center">
		<!-- List of all users the present user chatted with -->
		<ul id="chat-list" class="w-1/3 overflow-auto border-r p-4">
			{#each data.chatPartners as chatPartner}
				<ChatPartnerListItem {...chatPartner} />
			{/each}
		</ul>

		<!-- Chat window showing messages and input field -->
		<div id="chat-window" class="flex w-2/3 flex-col p-4">
			{@render children()}
		</div>
	</div>
</div>
