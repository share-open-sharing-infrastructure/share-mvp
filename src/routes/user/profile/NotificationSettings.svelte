<script lang="ts">
	import { texts } from '$lib/texts';
	import { Button } from 'flowbite-svelte';
	import { onMount } from 'svelte';
	import {
		setupPushSubscription,
		teardownPushSubscription,
		teardownAllPushSubscriptions,
	} from '$lib/utils/pushSubscription';

	// null         → not yet read from browser; section stays hidden during SSR
	//                and until onMount resolves the actual state.
	// 'unsupported' → Notification API unavailable; section stays hidden.
	let notifPermission = $state<NotificationPermission | 'unsupported' | null>(null);

	// Whether an active push subscription exists in this browser's push manager.
	// A granted permission alone does not imply an active subscription — the user
	// may have deactivated it, or browser data may have been cleared.
	let isPushSubscribed = $state(false);

	/** Reads the current browser permission and push-subscription state, then
	 *  updates the reactive variables so the component renders correctly.
	 *  notifPermission is written last so the section only becomes visible once
	 *  isPushSubscribed is already resolved, avoiding a visible flicker. */
	async function loadNotificationState() {
		if (!('Notification' in window)) {
			notifPermission = 'unsupported';
			return;
		}
		const permission = Notification.permission;
		if (permission === 'granted' && 'serviceWorker' in navigator && 'PushManager' in window) {
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.getSubscription();
			isPushSubscribed = subscription !== null;
		}
		notifPermission = permission;
	}

	onMount(() => {
		loadNotificationState();
	});

	async function enableNotifications() {
		const permission = await Notification.requestPermission();
		notifPermission = permission;
		if (permission === 'granted') {
			await setupPushSubscription();
			isPushSubscribed = true;
		}
	}

	async function deactivateNotifications() {
		await teardownPushSubscription();
		isPushSubscribed = false;
	}

	async function deactivateAllNotifications() {
		await teardownAllPushSubscriptions();
		isPushSubscribed = false;
	}
</script>

{#if notifPermission !== null && notifPermission !== 'unsupported'}
	<div class="max-w-2xl mx-auto px-4 pb-8">
		<div class="bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700 p-6 sm:p-8">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
				{texts.pages.profile.notifications.sectionTitle}
			</h2>
			{#if notifPermission === 'granted' && isPushSubscribed}
				<p class="text-sm text-green-600 dark:text-green-400 mb-4">
					{texts.pages.profile.notifications.enabled}
				</p>
				<div class="flex gap-2">
					<Button class="min-button bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-white" onclick={deactivateNotifications}>
						{texts.pages.profile.notifications.deactivateThisDevice}
					</Button>
					<Button class="min-button bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-white" onclick={deactivateAllNotifications}>
						{texts.pages.profile.notifications.deactivateAllDevices}
					</Button>
				</div>
			{:else if notifPermission === 'denied'}
				<p class="text-sm text-gray-600 dark:text-gray-400">
					{texts.pages.profile.notifications.denied}
				</p>
			{:else}
				<!-- Covers two cases:
				     • permission === 'default': user has not been asked yet
				     • permission === 'granted' but no active subscription: user previously
				       deactivated, or the browser subscription was lost (data cleared, etc.) -->
				<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
					{texts.pages.profile.notifications.description}
				</p>
				<Button class="min-button bg-primary" onclick={enableNotifications}>
					{texts.pages.profile.notifications.enable}
				</Button>
			{/if}
		</div>
	</div>
{/if}
