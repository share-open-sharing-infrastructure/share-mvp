<script lang="ts">
	import '../app.css';
	import NavBarComponent from '$lib/components/NavBarComponent.svelte';
	import FooterComponent from '$lib/components/FooterComponent.svelte';
	import PwaPrompts from '$lib/components/PwaPrompts.svelte';
	import { getClientPB } from '$lib/client-pb';
	import { setupPushSubscription } from '$lib/utils/pushSubscription';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { dev } from '$app/environment';
	import { SvelteSet } from 'svelte/reactivity';

	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let { children, data } = $props();

	// eslint-disable-next-line svelte/prefer-writable-derived
	let unreadCount = $state(0);
	let installPromptEvent = $state<BeforeInstallPromptEvent | null>(null);

	// Keep the local unread count in sync when the server reloads page data
	$effect(() => {
		unreadCount = data.unreadNotificationCount ?? 0;
	});

	onMount(() => {
		// Capture Chrome/Edge's install prompt before it shows the mini-infobar
		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			installPromptEvent = e as BeforeInstallPromptEvent;
		});

		// If push permission was already granted on a previous session, re-register
		// the subscription silently (covers cleared browser data / new device scenarios)
		if (data.currentUser && 'Notification' in window && Notification.permission === 'granted') {
			setupPushSubscription();
		}
	});

	// Realtime notification badge — re-subscribes when the authenticated user
	// changes (login / logout / user switch) by depending on `data.currentUser?.id`.
	// Keeping this in an $effect (rather than onMount) ensures the handler's
	// closure always reflects the currently-authenticated user, and that a
	// logout-then-login within the same session re-establishes the subscription
	// under the new session rather than leaving a stale one behind.
	$effect(() => {
		const userId = data.currentUser?.id;
		if (!userId) return;

		const pb = getClientPB();

		// Track IDs we silently absorbed so we don't double-decrement
		const suppressedIds = new SvelteSet<string>();

		pb.collection('notifications').subscribe('*', (e) => {
			if (e.record.recipient !== userId) return;
			if (e.action === 'create' && !e.record.read) {
				// If the user is already viewing this conversation, mark it as read
				// immediately and don't bump the badge
				if (e.record.relatedId && e.record.relatedId === page.params.conversationId) {
					suppressedIds.add(e.record.id);
					pb.collection('notifications').update(e.record.id, { read: true }).catch(() => {});
					return;
				}
				unreadCount += 1;
			} else if (e.action === 'update' && e.record.read) {
				if (suppressedIds.has(e.record.id)) {
					// This update was triggered by our own suppression — don't decrement
					suppressedIds.delete(e.record.id);
					return;
				}
				// Mark-as-read updates from the notifications page or conversation load
				unreadCount = Math.max(0, unreadCount - 1);
			}
		});

		return () => {
			pb.collection('notifications').unsubscribe('*');
		};
	});


</script>

<div class="min-h-screen flex flex-col bg-secondary-200">
	{#if page.url.pathname !== '/onboarding'}
		<NavBarComponent
			loggedIn={!!data.currentUser}
			currentUser={data.currentUser}
			{unreadCount}
		/>
	{/if}

	<main class="flex-1">
		<!--
			Dev-only workaround. SvelteKit 2 + Svelte 5 in `vite dev` intermittently
			fails to remove the previous route's DOM from {@render children()} when
			the child route tree structure changes (e.g. flat route <-> nested-layout
			route), producing a "page stacking" bug where the old page survives as
			a sibling of the snippet's block markers. Forcing a keyed remount on
			route.id bypasses the broken snippet-diff path. Confirmed not needed in
			production builds (preview and deployed both behave correctly without
			it), so the `dev` gate avoids wasting SvelteKit's default layout reuse
			for real users. Check if this can be removed in future versions.
		-->
		{#if dev}
			{#key page.route.id}
				{@render children()}
			{/key}
		{:else}
			{@render children()}
		{/if}
	</main>

	<PwaPrompts
		loggedIn={!!data.currentUser}
		onNotificationGranted={setupPushSubscription}
		{installPromptEvent}
	/>

	{#if page.url.pathname !== '/onboarding'}
		<FooterComponent />
	{/if}
</div>
