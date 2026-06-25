<script lang="ts">
	import { texts } from '$lib/texts';
	import ConversationList from './ConversationList.svelte';
	import { getClientPB } from '$lib/client-pb';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import type { Conversation } from '$lib/types/models';

	let { data, children } = $props();

	let activeTab: 'lending' | 'borrowing' = $state('borrowing');

	// Auto-switch the tab when a conversation is opened directly (e.g. from a notification).
	// untrack(conversations) prevents real-time list updates from re-running this and
	// overriding a tab the user manually selected while a conversation is open.
	$effect(() => {
		const id = page.params.conversationId;
		if (!id) return;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const match = untrack(() => conversations.find((c: any) => c.id === id));
		if (!match) return;
		activeTab = match.itemOwner === data.currentUser.id ? 'lending' : 'borrowing';
	});

	const hasConversation = $derived(!!page.params.conversationId);

	let outerEl: HTMLDivElement | undefined = $state();

	// Lock the document while a conversation route is mounted so the page itself can
	// never scroll: the chat is a fixed-height app shell, and a scrollable document is
	// what let the mobile keyboard scroll the whole page down (revealing the footer)
	// instead of just reflowing the chat. The footer and the root <main> padding still
	// exist in flow but are simply clipped below the fold. Scoped here (rather than in
	// the root layout) via mount/unmount, the same pattern modals use for scroll-locking.
	$effect(() => {
		const html = document.documentElement;
		const body = document.body;
		const prevHtml = html.style.overflow;
		const prevBody = body.style.overflow;
		html.style.overflow = 'hidden';
		body.style.overflow = 'hidden';
		return () => {
			html.style.overflow = prevHtml;
			body.style.overflow = prevBody;
		};
	});

	// Size the chat container to fill the *visual* viewport below the navbar.
	// Using visualViewport.height (rather than 100dvh) means the on-screen mobile
	// keyboard shrinks the container: the message list (flex-1) absorbs the shrink
	// and the input bar rides up just above the keyboard, matching native chat apps.
	// The scroll-lock above keeps the page itself from scrolling, so the keyboard only
	// reflows this container.
	$effect(() => {
		if (!outerEl) return;

		const vv = window.visualViewport;

		const update = () => {
			const top = outerEl!.getBoundingClientRect().top + window.scrollY;
			const viewportHeight = vv ? vv.height : window.innerHeight;
			outerEl!.style.height = `${viewportHeight - top}px`;
		};

		update();
		window.addEventListener('resize', update);
		vv?.addEventListener('resize', update);
		vv?.addEventListener('scroll', update);
		return () => {
			window.removeEventListener('resize', update);
			vv?.removeEventListener('resize', update);
			vv?.removeEventListener('scroll', update);
		};
	});

	// Local mutable copy so realtime updates can clear the unread dots.
	// Initialized from data directly (not []) so the auto-switch $effect finds a match on first run.
	let conversations: Conversation[] = $derived([...data.conversations]);

	$effect(() => {
		conversations = [...data.conversations];
	});

	const lendingConversations = $derived(
		conversations.filter((c: Conversation) => c.itemOwner === data.currentUser.id)
	);
	const borrowingConversations = $derived(
		conversations.filter((c: Conversation) => c.requester === data.currentUser.id)
	);

	function switchTab(tab: 'lending' | 'borrowing') {
		activeTab = tab;
	}

	onMount(() => {
		const pb = getClientPB();

		pb.collection('conversations').subscribe('*', async (e) => {
			if (e.action === 'update') {
				conversations = conversations.map((c) =>
					c.id === e.record.id
						? { ...c, readByOwner: e.record.readByOwner, readByRequester: e.record.readByRequester }
						: c
				);
			} else if (e.action === 'create') {
				if (conversations.some((c) => c.id === e.record.id)) return;
				try {
					// Subscription events don't include expanded relations — fetch the full record.
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const full: any = await pb.collection('conversations').getOne(e.record.id, {
						expand: 'requester,itemOwner,requestedItem'
					});
					conversations = [...conversations, full];
				} catch {
					// Record may have been deleted before we could fetch it — ignore silently.
				}
			}
		});

		return () => {
			pb.collection('conversations').unsubscribe('*');
		};
	});
</script>

<!-- Height is set dynamically via $effect to fill viewport below the navbar -->
<div bind:this={outerEl} class="flex flex-col">
	<div class="flex-1 min-h-0 mx-auto w-full max-w-5xl flex gap-3 px-3 py-3">

		<!-- SIDEBAR — full width on mobile when no conversation open, fixed width on desktop -->
		<div class="{hasConversation ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 shrink-0 bg-tinte-50 dark:bg-tinte-900 border border-tinte-200 dark:border-tinte-700 rounded-2xl overflow-hidden">

			<!-- Sidebar title -->
			<div class="px-4 pt-4 pb-3 shrink-0 border-b border-tinte-100 dark:border-tinte-800">
				<h2 class="text-lg font-bold text-tinte-900 dark:text-white tracking-tight">
					{texts.pages.conversations.title}
				</h2>
			</div>

			<!-- Segmented tab control -->
			<div class="px-3 py-2.5 shrink-0">
				<div class="flex p-1 bg-tinte-100 dark:bg-tinte-800 rounded-xl gap-1">
					<button
						onclick={() => switchTab('borrowing')}
						class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-sm font-medium rounded-lg transition-all hover:cursor-pointer
							{activeTab === 'borrowing'
								? 'bg-white dark:bg-tinte-700 text-primary shadow-sm'
								: 'text-tinte-500 dark:text-tinte-400 hover:text-tinte-700 dark:hover:text-tinte-200'}"
					>
						{texts.pages.conversations.borrowing}
						{#if borrowingConversations.length > 0}
							<span class="w-4 h-4 rounded-full text-[10px] font-bold leading-none flex items-center justify-center shrink-0
								{activeTab === 'borrowing'
									? 'bg-primary text-white'
									: 'bg-tinte-300 dark:bg-tinte-600 text-tinte-600 dark:text-tinte-300'}">
								{borrowingConversations.length}
							</span>
						{/if}
					</button>
					<button
						onclick={() => switchTab('lending')}
						class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-sm font-medium rounded-lg transition-all hover:cursor-pointer
							{activeTab === 'lending'
								? 'bg-white dark:bg-tinte-700 text-accent shadow-sm'
								: 'text-tinte-500 dark:text-tinte-400 hover:text-tinte-700 dark:hover:text-tinte-200'}"
					>
						{texts.pages.conversations.lending}
						{#if lendingConversations.length > 0}
							<span class="w-4 h-4 rounded-full text-[10px] font-bold leading-none flex items-center justify-center shrink-0
								{activeTab === 'lending'
									? 'bg-accent text-white'
									: 'bg-tinte-300 dark:bg-tinte-600 text-tinte-600 dark:text-tinte-300'}">
								{lendingConversations.length}
							</span>
						{/if}
					</button>
				</div>
			</div>

			<!-- Conversation list fills remaining sidebar height -->
			<ConversationList
				{activeTab}
				{lendingConversations}
				{borrowingConversations}
				currentUser={data.currentUser}
				PB_IMG_URL={data.PB_IMG_URL}
			/>
		</div>

		<!-- CHAT PANEL — hidden on mobile when no conversation open -->
		<div class="{hasConversation ? 'flex' : 'hidden md:flex'} flex-col w-full md:flex-1 border border-tinte-200 dark:border-tinte-700 rounded-2xl overflow-hidden bg-papier dark:bg-tinte-900">
			{@render children()}
		</div>

	</div>
</div>
