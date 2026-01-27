<script lang="ts">
	import ConversationListItem from './ConversationListItem.svelte';

    let { data, children } = $props();
</script>

<div class="m-2 flex flex-col items-center justify-center">
	<div class="mx-auto max-w-screen-sm text-center">
	<h2 class="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
		Unterhaltungen
	</h2>
</div>

	<!-- Main chat window container including chat list and messages -->
	<div id="chat-container" class="flex h-150 w-full max-w-3xl justify-center gap-2">
		<!-- List of all users the present user chatted with -->
		<div class="w-1/3 border rounded-[20px]">
			<div class="flex justify-center font-bold text-lg items-center h-15 truncate border-b">
				Unterhaltungen
			</div>
			<ul id="chat-list" class="w-full p-2">
				{#each data.conversations as conversation}
					<ConversationListItem 
						conversation={conversation} 
						currentUser={data.currentUser} 
						PB_IMG_URL={data.PB_IMG_URL} 
						/>
				{/each}
			</ul>
		</div>

		<!-- Chat window showing messages and input field -->
		<div id="chat-window" class="flex w-2/3 flex-col border rounded-[20px]">
			{@render children()}
		</div>
	</div>
</div>
