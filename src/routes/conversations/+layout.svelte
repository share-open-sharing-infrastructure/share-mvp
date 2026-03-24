<script lang="ts">
	import { texts } from '$lib/texts';
	import ConversationList from './ConversationList.svelte';

	let { data, children } = $props();

	let activeTab: 'lending' | 'borrowing' = $state('borrowing');

	const lendingConversations = $derived(
		data.conversations.filter((c: any) => c.itemOwner === data.currentUser.id)
	);
	const borrowingConversations = $derived(
		data.conversations.filter((c: any) => c.requester === data.currentUser.id)
	);
</script>

<!-- HEADER -->
<div class="px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center">
		<h2 class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white">
			{texts.pages.conversations.title}
		</h2>
	</div>
</div>

<!-- TAB BUTTONS — full width below headline -->
<div class="flex justify-center px-2 mt-3 mb-1">
	<div class="flex gap-2 w-full max-w-3xl">
		<button
			onclick={() => (activeTab = 'borrowing')}
			class="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-sm font-semibold transition-colors border border-primary hover:cursor-pointer
				{activeTab === 'borrowing'
				? 'bg-blue-500 text-white shadow-sm'
				: 'bg-gray-100 text-gray-500 hover:text-gray-700 dark:bg-gray-800 dark:hover:text-gray-300 hover:bg-primary-50'}"
		>
			{texts.pages.conversations.borrowing}
			{#if borrowingConversations.length > 0}
				<span
					class="rounded-full px-2 py-0.5 text-xs leading-none
						{activeTab === 'borrowing'
						? 'bg-blue-700 text-white'
						: 'bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}"
				>
					{borrowingConversations.length}
				</span>
			{/if}
		</button>
		<button
			onclick={() => (activeTab = 'lending')}
			class="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-sm font-semibold transition-colors border border-accent hover:cursor-pointer
				{activeTab === 'lending'
				? 'bg-accent-100 text-amber-900 shadow-sm'
				: 'bg-gray-100 text-gray-500 hover:text-gray-700 dark:bg-gray-800 dark:hover:text-gray-300 '}"
		>
			{texts.pages.conversations.lending}
			{#if lendingConversations.length > 0}
				<span
					class="rounded-full px-2 py-0.5 text-xs leading-none
						{activeTab === 'lending'
						? 'bg-accent text-white'
						: 'bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-300 '}"
				>
					{lendingConversations.length}
				</span>
			{/if}
		</button>
	</div>
</div>

<div class="m-2 flex flex-col items-center justify-center">
	<!-- Main chat window container including chat list and messages -->
	<div id="chat-container" class="flex h-100 w-full max-w-3xl justify-center gap-2">
		<ConversationList
			{activeTab}
			{lendingConversations}
			{borrowingConversations}
			currentUser={data.currentUser}
			PB_IMG_URL={data.PB_IMG_URL}
		/>

		<!-- Chat window showing messages and input field -->
		<div id="chat-window" class="flex w-3/4 flex-col border rounded-[20px]">
			{@render children()}
		</div>
	</div>
</div>
