<script lang="ts">
	import ConversationList from './ConversationList.svelte';

    let { data, children } = $props();
</script>

<div class="m-2 flex flex-col items-center justify-center">
	<div class="mx-auto max-w-screen-sm text-center">
		<h2 class="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
			Alle Anfragen
		</h2>
	</div>

	<!-- Main chat window container including chat list and messages -->
	<div id="chat-container" class="flex h-150 w-full max-w-3xl justify-center gap-2">
		<ConversationList 
			conversations={data.conversations} 
			currentUser={data.currentUser} 
			PB_IMG_URL={data.PB_IMG_URL} 
			/>

		<!-- Chat window showing messages and input field -->
		<div id="chat-window" class="flex w-3/4 flex-col border rounded-[20px]">
			{@render children()}
		</div>
	</div>
</div>
