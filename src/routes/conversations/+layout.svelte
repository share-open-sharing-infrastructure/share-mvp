<script lang="ts">
	import { texts } from '$lib/texts';
	import ConversationList from './ConversationList.svelte';
	import { getClientPB } from '$lib/client-pb';
	import { subscribeConversationList } from './conversationListRealtime';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { Conversation } from '$lib/types/models';

	let { data, children } = $props();

	// Filter state — written ONLY by the click handlers below, never by effects or
	// navigation. The filters affect the sidebar list only: the open conversation stays
	// open even when they hide it from the list.
	// null = no filter selected, show both lending and borrowing conversations.
	let activeFilter: 'lending' | 'borrowing' | null = $state(null);
	let showOnlyActive = $state(true);

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
	// On a cold load (push/share link, reload) the mobile visual viewport isn't settled
	// yet — the browser toolbar is still expanded, so a single mount-time measurement
	// fixes too small a height and the scroll-lock stops a correcting event from firing.
	// So we re-measure across the settle window: after first paint (rAF), after the
	// toolbar collapses (timeout), and on window `load` / `orientationchange`, on top of
	// the live resize/scroll listeners. On internal navigation the viewport is already
	// settled → the extra passes are harmless no-ops.
	$effect(() => {
		if (!outerEl) return;

		const vv = window.visualViewport;

		const update = () => {
			const top = outerEl!.getBoundingClientRect().top + window.scrollY;
			const viewportHeight = vv ? vv.height : window.innerHeight;
			outerEl!.style.height = `${viewportHeight - top}px`;
		};

		update();
		const rafId = requestAnimationFrame(update);
		const timeoutId = setTimeout(update, 250);
		window.addEventListener('load', update);
		window.addEventListener('orientationchange', update);
		window.addEventListener('resize', update);
		vv?.addEventListener('resize', update);
		vv?.addEventListener('scroll', update);
		return () => {
			cancelAnimationFrame(rafId);
			clearTimeout(timeoutId);
			window.removeEventListener('load', update);
			window.removeEventListener('orientationchange', update);
			window.removeEventListener('resize', update);
			vv?.removeEventListener('resize', update);
			vv?.removeEventListener('scroll', update);
		};
	});

	// Local writable derived: re-derives from data.conversations whenever load() reruns
	// (e.g. invalidateAll on realtime reconnect) and also accepts direct writes from the
	// realtime handler below (clearing unread dots).
	let conversations: Conversation[] = $derived([...data.conversations]);

	// Role/status predicates shared by the tab counts and the visibility filter.
	const isLending = (c: Conversation) => c.itemOwner === data.currentUser.id;
	const isActive = (c: Conversation) =>
		!c.lendingStatus || !['rejected', 'completed'].includes(c.lendingStatus);
	const matchesRole = (c: Conversation) =>
		activeFilter === null || (activeFilter === 'lending') === isLending(c);

	const lendingConversations = $derived(conversations.filter(isLending));
	const borrowingConversations = $derived(conversations.filter((c) => !isLending(c)));

	// Conversations after the lending/borrowing filter, before the "only active" checkbox —
	// used to tell whether an empty result is due to the active-only filter or to genuinely
	// having no conversations of that type.
	const conversationsByFilter = $derived(conversations.filter(matchesRole));

	// The filters apply strictly to the list — a conversation they hide stays open in the
	// chat panel but is not shown (or highlighted) in the sidebar.
	const visibleConversations = $derived(
		conversationsByFilter.filter((c) => !showOnlyActive || isActive(c))
	);

	const emptyReason = $derived(
		conversationsByFilter.length > 0
			? 'active'
			: activeFilter === 'lending'
				? 'lending'
				: activeFilter === 'borrowing'
					? 'borrowing'
					: 'none'
	);

	function toggleFilter(filter: 'lending' | 'borrowing') {
		activeFilter = activeFilter === filter ? null : filter;
	}

	onMount(() => {
		// Resilient list sync: retries a failed connect and re-establishes itself after a
		// network drop / mobile background-freeze; on reconnect, refetch the list since
		// changes made while the stream was down aren't replayed. See ./conversationListRealtime
		// and #435.
		return subscribeConversationList(
			getClientPB(),
			() => conversations,
			(next) => (conversations = next),
			() => invalidateAll()
		);
	});
</script>

<!-- Height is set dynamically via $effect to fill viewport below the navbar; the
	100dvh inline baseline covers the JS-lag window on cold load (before the $effect
	measures) so the footer never blitzes through — the $effect then overwrites
	style.height with the exact px value. -->
<div bind:this={outerEl} class="flex flex-col" style="height: 100dvh">
	<div class="flex-1 min-h-0 mx-auto w-full max-w-5xl flex gap-3 px-3 py-3">
		<!-- SIDEBAR — full width on mobile when no conversation open, fixed width on desktop -->
		<div
			class="{hasConversation
				? 'hidden md:flex'
				: 'flex'} flex-col w-full md:w-72 shrink-0 bg-tinte-50 dark:bg-tinte-900 border border-tinte-200 dark:border-tinte-700 rounded-2xl overflow-hidden"
		>
			<!-- Sidebar title -->
			<div
				class="px-4 pt-4 pb-3 shrink-0 border-b border-tinte-100 dark:border-tinte-800"
			>
				<h2
					class="text-lg font-bold text-tinte-900 dark:text-white tracking-tight"
				>
					{texts.pages.conversations.title}
				</h2>
			</div>

			<!-- Segmented filter control — a click selects that filter, clicking the
				already-selected one deselects it back to "show all" -->
			<div class="px-3 py-2.5 shrink-0">
				<div class="flex p-1 bg-tinte-100 dark:bg-tinte-800 rounded-xl gap-1">
					<button
						onclick={() => toggleFilter('borrowing')}
						class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-sm font-medium rounded-lg transition-all hover:cursor-pointer
							{activeFilter === 'borrowing'
							? 'bg-white dark:bg-tinte-700 text-primary shadow-sm'
							: 'text-primary-300 dark:text-primary-400/70 hover:text-primary'}"
					>
						{texts.pages.conversations.borrowing}
						{#if borrowingConversations.length > 0}
							<span
								class="w-4 h-4 rounded-full text-[10px] font-bold leading-none flex items-center justify-center shrink-0
								{activeFilter === 'borrowing'
									? 'bg-primary text-white'
									: 'bg-tinte-300 dark:bg-tinte-600 text-tinte-600 dark:text-tinte-300'}"
							>
								{borrowingConversations.length}
							</span>
						{/if}
					</button>
					<button
						onclick={() => toggleFilter('lending')}
						class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-sm font-medium rounded-lg transition-all hover:cursor-pointer
							{activeFilter === 'lending'
							? 'bg-white dark:bg-tinte-700 text-accent shadow-sm'
							: 'text-accent-300 dark:text-accent-400/70 hover:text-accent'}"
					>
						{texts.pages.conversations.lending}
						{#if lendingConversations.length > 0}
							<span
								class="w-4 h-4 rounded-full text-[10px] font-bold leading-none flex items-center justify-center shrink-0
								{activeFilter === 'lending'
									? 'bg-accent text-white'
									: 'bg-tinte-300 dark:bg-tinte-600 text-tinte-600 dark:text-tinte-300'}"
							>
								{lendingConversations.length}
							</span>
						{/if}
					</button>
				</div>
			</div>

			<!-- Only-active-conversations checkbox -->
			<div class="px-3 pb-2.5 shrink-0">
				<label class="flex items-center gap-2 text-xs text-tinte-500 dark:text-tinte-400 hover:cursor-pointer">
					<input
						type="checkbox"
						checked={showOnlyActive}
						onchange={(e) => (showOnlyActive = e.currentTarget.checked)}
						class="w-3.5 h-3.5 rounded border-tinte-300 dark:border-tinte-600 text-primary focus:ring-primary"
					/>
					{texts.pages.conversations.onlyActiveLabel}
				</label>
			</div>

			<!-- Conversation list fills remaining sidebar height -->
			<ConversationList
				conversations={visibleConversations}
				{emptyReason}
				currentUser={data.currentUser}
				PB_IMG_URL={data.PB_IMG_URL}
			/>
		</div>

		<!-- CHAT PANEL — hidden on mobile when no conversation open -->
		<div
			class="{hasConversation
				? 'flex'
				: 'hidden md:flex'} flex-col w-full md:flex-1 border border-tinte-200 dark:border-tinte-700 rounded-2xl overflow-hidden bg-papier dark:bg-tinte-900"
		>
			{@render children()}
		</div>
	</div>
</div>
