<script lang="ts">
	import '../app.css';
	import NavBarComponent from '$lib/components/NavBarComponent.svelte';
	import FooterComponent from '$lib/components/FooterComponent.svelte';
	import PwaPrompts from '$lib/components/PwaPrompts.svelte';
	import OnboardingPrompt from '$lib/components/OnboardingPrompt.svelte';
	import { getClientPB } from '$lib/client-pb';
	import { setupPushSubscription } from '$lib/utils/pushSubscription';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { beforeNavigate, afterNavigate } from '$app/navigation';
	import { dev } from '$app/environment';
	import { fade } from 'svelte/transition';
	import AllerLoader from '$lib/components/AllerLoader.svelte';
	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let { children, data } = $props();

	let isNavigating = $state(false);
	beforeNavigate(() => { isNavigating = true; });
	afterNavigate(() => { isNavigating = false; });

	// svelte-ignore state_referenced_locally
	let unreadCount = $state(data.unreadNotificationCount ?? 0);
	let installPromptEvent = $state<BeforeInstallPromptEvent | null>(null);

	// Sync from server when the layout load genuinely re-runs (navigation).
	// Using a plain variable prevents spurious resets when only the page load
	// replaced `data` without the layout count actually changing.
	let _serverCount: number | undefined = undefined;
	$effect(() => {
		const count = data.unreadNotificationCount ?? 0;
		if (count !== _serverCount) {
			_serverCount = count;
			unreadCount = count;
		}
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

		// Set up once at mount rather than in $effect — $effect's cleanup/re-run cycle
		// tears down and re-creates the subscription on every invalidateAll(), which
		// causes PocketBase to auto-cancel concurrent getList requests.
		// Login/logout are full-page navigations in SvelteKit, so remounting handles
		// user changes correctly without needing $effect reactivity here.
		const userId = data.currentUser?.id;
		if (!userId) return;

		const pb = getClientPB();

		pb.collection('notifications').subscribe('*', async (e) => {
			if (e.record.recipient !== userId) return;

			// Auto-mark as read when a notification arrives for the currently-open conversation
			if (
				e.action === 'create' &&
				!e.record.read &&
				e.record.relatedId &&
				e.record.relatedId === page.params.conversationId
			) {
				await pb.collection('notifications').update(e.record.id, { read: true }).catch(() => {});
			}

			try {
				const result = await pb.collection('notifications').getList(1, 1, {
					filter: pb.filter('recipient = {:userId} && read = false', { userId }),
				});
				unreadCount = result.totalItems;
			} catch (err) {
				// status 0 = auto-cancelled by PocketBase (a concurrent request superseded this one).
				// The superseding request will update the badge, so this is safe to ignore.
				if ((err as { status?: number }).status !== 0) throw err;
			}
		});

		return () => pb.collection('notifications').unsubscribe('*');
	});


</script>

<svelte:head>
	<meta property="og:site_name" content="AllerLeih" />
	<meta property="og:locale" content="de_DE" />
</svelte:head>

<div class="min-h-screen flex flex-col bg-secondary-100">
	{#if page.url.pathname !== '/onboarding'}
		<NavBarComponent
			loggedIn={!!data.currentUser}
			currentUser={data.currentUser}
			{unreadCount}
		/>
	{/if}

	<main class="flex-1 py-8">
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

	{#if isNavigating}
		<div
			in:fade={{ delay: 200, duration: 150 }}
			out:fade={{ duration: 80 }}
			class="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm"
			aria-live="polite"
			aria-busy="true"
		>
			<AllerLoader size={80} variant="rotate" />
		</div>
	{/if}

	<PwaPrompts
		loggedIn={!!data.currentUser}
		onNotificationGranted={setupPushSubscription}
		{installPromptEvent}
	/>
	<OnboardingPrompt show={!!data.currentUser && !data.currentUser.hasOnboarded} />

	{#if page.url.pathname !== '/onboarding'}
		<FooterComponent />
	{/if}
</div>
