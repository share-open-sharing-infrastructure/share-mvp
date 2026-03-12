<script lang="ts">
	import { texts } from '$lib/texts';
	import ConversationList from './ConversationList.svelte';

	let { data, children } = $props();
</script>

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
