<script lang="ts">
	import '../app.css';
	import { Button, Modal } from 'flowbite-svelte';
	import FeedbackForm from '$lib/components/FeedbackForm.svelte';
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

	let isFeedbackModalOpen = $state(false);
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

		if (!data.currentUser) return;

		// ── Realtime notification badge ──────────────────────────────────────
		const pb = getClientPB();

		// Track IDs we silently absorbed so we don't double-decrement
		const suppressedIds = new SvelteSet<string>();

		pb.collection('notifications').subscribe('*', (e) => {
			if (e.record.recipient !== data.currentUser?.id) return;
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

		// If push permission was already granted on a previous session, re-register
		// the subscription silently (covers cleared browser data / new device scenarios)
		if ('Notification' in window && Notification.permission === 'granted') {
			setupPushSubscription();
		}

		return () => {
			pb.collection('notifications').unsubscribe('*');
		};
	});


</script>

<div class="min-h-screen flex flex-col">
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
			for real users. Remove entirely once the upstream bug is resolved.
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
		<Button
			pill
			onclick={(): void => {
				isFeedbackModalOpen = true;
			}}
			class="
					min-button
					bg-accent-200
					fixed bottom-10 left-10 z-50
					cursor-pointer
				"
		>
			Feedback
		</Button>

		<Modal bind:open={isFeedbackModalOpen} size="sm" title="Feedback geben">
			<FeedbackForm onsuccess={() => { isFeedbackModalOpen = false; }} />
		</Modal>

		<FooterComponent />
	{/if}
</div>
