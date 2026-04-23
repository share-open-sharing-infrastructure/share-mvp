<script lang="ts">
	import { texts } from '$lib/texts';
	import ConversationList from './ConversationList.svelte';
	import PocketBase from 'pocketbase';
	import { PUBLIC_PB_URL } from '$env/static/public';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	let { data, children } = $props();

	let activeTab: 'lending' | 'borrowing' = $state('borrowing');
	const hasConversation = $derived(!!page.params.conversationId);

	let outerEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!outerEl) return;

		const update = () => {
			const top = outerEl!.getBoundingClientRect().top + window.scrollY;
			outerEl!.style.height = `calc(100dvh - ${top}px)`;
		};

		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	});

	// Local mutable copy so realtime updates can clear the unread dots
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, svelte/prefer-writable-derived
	let conversations: any[] = $state([]);

	// Sync from server data on first render and whenever data refreshes
	$effect(() => {
		conversations = [...data.conversations];
	});

	const lendingConversations = $derived(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		conversations.filter((c: any) => c.itemOwner === data.currentUser.id)
	);
	const borrowingConversations = $derived(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		conversations.filter((c: any) => c.requester === data.currentUser.id)
	);

	$effect(() => {
		const id = page.params.conversationId;
		if (!id) return;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const match = conversations.find((c: any) => c.id === id);
		if (!match) return;
		activeTab = match.itemOwner === data.currentUser.id ? 'lending' : 'borrowing';
	});

	onMount(() => {
		const pb = new PocketBase(PUBLIC_PB_URL);
		pb.authStore.loadFromCookie(document.cookie || '');

		pb.collection('conversations').subscribe('*', (e) => {
			if (e.action !== 'update') return;
			conversations = conversations.map((c) =>
				c.id === e.record.id
					? { ...c, readByOwner: e.record.readByOwner, readByRequester: e.record.readByRequester }
					: c
			);
		});

		return () => {
			pb.collection('conversations').unsubscribe('*');
		};
	});
</script>

<!-- Height is set dynamically via $effect to 100dvh minus this element's top offset -->
<div bind:this={outerEl} class="flex flex-col">
	<!-- HEADER — shrink-0 so it takes only its natural height; hidden on mobile when a conversation is open -->
	<div class="{hasConversation ? 'hidden md:block' : ''} shrink-0 px-4 mx-auto max-w-7xl mt-4">
		<div class="mx-auto max-w-screen-sm text-center">
			<h2 class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white">
				{texts.pages.conversations.title}
			</h2>
		</div>
	</div>

	<!-- TAB BUTTONS — shrink-0; hidden on mobile when a conversation is open -->
	<div class="{hasConversation ? 'hidden md:flex' : 'flex'} shrink-0 justify-center px-2 mt-3 mb-1">
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

	<!-- Main container — flex-1 fills whatever height remains after title and tabs -->
	<div class="flex-1 min-h-0 mx-auto w-full max-w-3xl flex gap-2 px-2 pb-2">
		<!-- List: full width on mobile when no conversation open, hidden when one is -->
		<div class="{hasConversation ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-1/4 overflow-hidden">
			<ConversationList
				{activeTab}
				{lendingConversations}
				{borrowingConversations}
				currentUser={data.currentUser}
				PB_IMG_URL={data.PB_IMG_URL}
			/>
		</div>

		<!-- Chat window: hidden on mobile when no conversation, full width when open -->
		<div class="{hasConversation ? 'flex' : 'hidden md:flex'} flex-col w-full md:w-3/4 border rounded-2xl overflow-hidden">
			{@render children()}
		</div>
	</div>
</div>
