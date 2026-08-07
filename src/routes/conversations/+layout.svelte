<script lang="ts">
	import { texts } from '$lib/texts';
	import ConversationList from './ConversationList.svelte';
	import { getClientPB } from '$lib/client-pb';
	import { subscribeConversationList } from './conversationListRealtime';
	import { scrollLock, viewportHeight } from './chatViewport';
	import {
		matchesRole,
		matchesActive,
		emptyReason as computeEmptyReason,
		type ConversationRoleFilter,
	} from './conversationFilters';
	import { realtimeSynced } from '$lib/stores/realtimeSynced.svelte';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data, children } = $props();

	// Filter state — written ONLY by the click handlers below, never by effects or
	// navigation. The filters affect the sidebar list only: the open conversation stays
	// open even when they hide it from the list.
	let activeFilter: ConversationRoleFilter = $state(null);
	let showOnlyActive = $state(true);

	const hasConversation = $derived(!!page.params.conversationId);

	let outerEl: HTMLDivElement | undefined = $state();

	// Server-load data that the realtime handler below also writes to directly (clearing
	// unread dots, syncing status changes) — re-syncs from load() whenever it reruns (e.g.
	// invalidateAll() on realtime reconnect), same pattern as the detail page's messages/
	// lendingStatus/counterfactual boxes (issue #469).
	const conversations = realtimeSynced(() => data.conversations);

	// Segmented filter control config — literal Tailwind classes per tab/state (never
	// interpolated, e.g. no `text-${color}`) so the two near-identical buttons collapse
	// into one data-driven `{#each}` instead of duplicated markup.
	const FILTER_TABS: {
		key: 'borrowing' | 'lending';
		label: string;
		activeClasses: string;
		inactiveClasses: string;
		badgeActiveClasses: string;
	}[] = [
		{
			key: 'borrowing',
			label: texts.pages.conversations.borrowing,
			activeClasses: 'bg-white dark:bg-tinte-700 text-primary shadow-sm',
			inactiveClasses: 'text-primary-300 dark:text-primary-400/70 hover:text-primary',
			badgeActiveClasses: 'bg-primary text-white',
		},
		{
			key: 'lending',
			label: texts.pages.conversations.lending,
			activeClasses: 'bg-white dark:bg-tinte-700 text-accent shadow-sm',
			inactiveClasses: 'text-accent-300 dark:text-accent-400/70 hover:text-accent',
			badgeActiveClasses: 'bg-accent text-white',
		},
	];
	const BADGE_INACTIVE_CLASSES = 'bg-tinte-300 dark:bg-tinte-600 text-tinte-600 dark:text-tinte-300';

	// Per-tab count, respecting the active-only checkbox so the badge always matches what
	// selecting that tab would show in the list.
	function tabCount(key: 'borrowing' | 'lending'): number {
		return conversations.value.filter(
			(c) => matchesRole(c, data.currentUser.id, key) && matchesActive(c, showOnlyActive)
		).length;
	}

	// Conversations after the lending/borrowing filter, before the "only active" checkbox —
	// used to tell whether an empty result is due to the active-only filter or to genuinely
	// having no conversations of that type.
	const conversationsByRole = $derived(
		conversations.value.filter((c) => matchesRole(c, data.currentUser.id, activeFilter))
	);

	// The filters apply strictly to the list — a conversation they hide stays open in the
	// chat panel but is not shown (or highlighted) in the sidebar.
	const visibleConversations = $derived(conversationsByRole.filter((c) => matchesActive(c, showOnlyActive)));

	const emptyReason = $derived(computeEmptyReason(conversationsByRole.length > 0, activeFilter));

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
			() => conversations.value,
			(next) => (conversations.value = next),
			() => invalidateAll()
		);
	});
</script>

<!-- Height is set dynamically via the viewportHeight action to fill viewport below the
	navbar; the 100dvh inline baseline covers the JS-lag window on cold load (before the
	action measures) so the footer never blitzes through — the action then overwrites
	style.height with the exact px value. scrollLock keeps the document itself from
	scrolling while this layout is mounted (see chatViewport.ts for both). -->
<div bind:this={outerEl} use:scrollLock use:viewportHeight class="flex flex-col" style="height: 100dvh">
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
					{#each FILTER_TABS as tab (tab.key)}
						{@const count = tabCount(tab.key)}
						<button
							onclick={() => toggleFilter(tab.key)}
							class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-sm font-medium rounded-lg transition-all hover:cursor-pointer
								{activeFilter === tab.key ? tab.activeClasses : tab.inactiveClasses}"
							aria-pressed={activeFilter === tab.key}
						>
							{tab.label}
							{#if count > 0}
								<span
									class="w-4 h-4 rounded-full text-[10px] font-bold leading-none flex items-center justify-center shrink-0
									{activeFilter === tab.key ? tab.badgeActiveClasses : BADGE_INACTIVE_CLASSES}"
								>
									{count}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<!-- Only-active-conversations checkbox -->
			<div class="px-3 pb-2.5 shrink-0">
				<label class="flex items-center gap-2 text-xs text-tinte-500 dark:text-tinte-400 hover:cursor-pointer">
					<input
						type="checkbox"
						bind:checked={showOnlyActive}
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
