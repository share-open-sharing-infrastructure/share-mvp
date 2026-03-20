<script lang="ts">
	import { texts } from '$lib/texts';
	import ConversationList from './ConversationList.svelte';

	let { data, children } = $props();
</script>

<!-- HEADER -->
<div class="px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center">
		<h2
			class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white"
		>
			{texts.pages.conversations.title}
		</h2>
	</div>
</div>
<div class="m-2 flex flex-col items-center justify-center">
	<!-- Main chat window container including chat list and messages -->
	<div
		id="chat-container"
		class="flex h-100 w-full max-w-3xl justify-center gap-2"
	>
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
