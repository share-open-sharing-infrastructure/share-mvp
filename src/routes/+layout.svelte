<script lang="ts">
	import '../app.css';
	import { Button, Modal } from 'flowbite-svelte';
	import FeedbackForm from '$lib/components/FeedbackForm.svelte';
	import NavBarComponent from '$lib/components/NavBarComponent.svelte';
	import FooterComponent from '$lib/components/FooterComponent.svelte';
	import PocketBase from 'pocketbase';
	import { PUBLIC_PB_URL, PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';
	import { onMount } from 'svelte';

	let { children, data } = $props();

	let isFeedbackModalOpen = $state(false);
	let unreadCount = $derived(0);

	// Keep the local unread count in sync when the server reloads page data
	$effect(() => {
		unreadCount = data.unreadNotificationCount ?? 0;
	});

	onMount(() => {
		if (!data.currentUser) return;

		// ── Realtime notification badge ──────────────────────────────────────
		const pb = new PocketBase(PUBLIC_PB_URL);
		pb.authStore.loadFromCookie(document.cookie || '');

		pb.collection('notifications').subscribe('*', (e) => {
			if (e.record.recipient !== data.currentUser?.id) return;
			if (e.action === 'create' && !e.record.read) {
				unreadCount += 1;
			} else if (e.action === 'update' && e.record.read) {
				// Mark-as-read updates from the notifications page
				unreadCount = Math.max(0, unreadCount - 1);
			}
		});

		// ── PWA push subscription ────────────────────────────────────────────
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

		navigator.serviceWorker.ready.then(async (registration) => {
			// Don't prompt again if already granted/denied
			if (Notification.permission === 'denied') return;

			const permission = await Notification.requestPermission();
			if (permission !== 'granted') return;

			try {
				const existing = await registration.pushManager.getSubscription();
				const subscription =
					existing ??
					(await registration.pushManager.subscribe({
						userVisibleOnly: true,
						applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_PUBLIC_KEY),
					}));

				const { endpoint, keys } = subscription.toJSON() as {
					endpoint: string;
					keys: { p256dh: string; auth: string };
				};

				await fetch('/api/push-subscribe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ endpoint, keys }),
				});
			} catch (err) {
				console.error('Push subscription failed:', err);
			}
		});

		return () => {
			pb.collection('notifications').unsubscribe('*');
		};
	});

	/** Convert a base64url VAPID public key to a Uint8Array for the Web Push API. */
	function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const rawData = atob(base64);
		const output = new Uint8Array(rawData.length);
		for (let i = 0; i < rawData.length; i++) {
			output[i] = rawData.charCodeAt(i);
		}
		return output;
	}
</script>

<div class="min-h-screen flex flex-col">
	<NavBarComponent
		loggedIn={!!data.currentUser}
		currentUser={data.currentUser}
		{unreadCount}
	/>

	<main class="flex-1">
		{@render children()}
	</main>

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
		<FeedbackForm />
	</Modal>

	<FooterComponent />
</div>
