<script lang="ts">
	import { texts } from '$lib/texts';
	import { Button, Toggle } from 'flowbite-svelte';
	import { onMount } from 'svelte';
	import {
		setupPushSubscription,
		teardownPushSubscription,
		teardownAllPushSubscriptions,
	} from '$lib/utils/pushSubscription';
	import { getClientPB } from '$lib/client-pb';

	let { userId, verified }: { userId: string; verified: boolean } = $props();

	// null         → not yet read from browser; section stays hidden during SSR
	//                and until onMount resolves the actual state.
	// 'unsupported' → Notification API unavailable; section stays hidden.
	let notifPermission = $state<NotificationPermission | 'unsupported' | null>(null);

	// Whether an active push subscription exists in this browser's push manager.
	// A granted permission alone does not imply an active subscription — the user
	// may have deactivated it, or browser data may have been cleared.
	let isPushSubscribed = $state(false);

	// Email notification preference state
	let emailNotificationsEnabled = $state(true);
	let emailPrefsRecordId = $state<string | null>(null);
	let emailPrefsLoaded = $state(false);

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

	/** Loads the user's email notification preference from user_preferences collection. */
	async function loadEmailPreference() {
		try {
			const pb = getClientPB();
			const records = await pb.collection('user_preferences').getList(1, 1, {
				filter: pb.filter('user = {:userId}', { userId }),
			});
			if (records.items.length > 0) {
				const prefs = records.items[0];
				emailPrefsRecordId = prefs.id;
				emailNotificationsEnabled = prefs.emailNotifications !== false;
			} else {
				// No record = default opted-in
				emailNotificationsEnabled = true;
				emailPrefsRecordId = null;
			}
		} catch {
			// If collection doesn't exist or request fails, default to opted-in
			emailNotificationsEnabled = true;
		}
		emailPrefsLoaded = true;
	}

	onMount(() => {
		loadNotificationState();
		loadEmailPreference();
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

	async function toggleEmailNotifications() {
		// Email notifications are only delivered to verified addresses (#8), so the toggle is
		// inert until the user verifies. The Toggle is also rendered disabled in that state.
		if (!verified) return;

		const newValue = !emailNotificationsEnabled;
		emailNotificationsEnabled = newValue;

		try {
			const pb = getClientPB();
			if (emailPrefsRecordId) {
				// Update existing record
				await pb.collection('user_preferences').update(emailPrefsRecordId, {
					emailNotifications: newValue,
				});
			} else {
				// Create new record
				const record = await pb.collection('user_preferences').create({
					user: userId,
					emailNotifications: newValue,
				});
				emailPrefsRecordId = record.id;
			}
		} catch {
			// Revert on failure
			emailNotificationsEnabled = !newValue;
		}
	}
</script>

{#if notifPermission !== null && notifPermission !== 'unsupported'}
	<div class="max-w-2xl mx-auto px-4 pb-8">
		<div class="bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-6 sm:p-8">
			<h2 class="text-lg font-semibold text-tinte-900 dark:text-white mb-2">
				{texts.pages.profile.notifications.sectionTitle}
			</h2>
			{#if notifPermission === 'granted' && isPushSubscribed}
				<p class="text-sm text-green-600 dark:text-green-400 mb-4">
					{texts.pages.profile.notifications.enabled}
				</p>
				<div class="flex gap-2">
					<Button class="min-button bg-tinte-200 hover:bg-accent-300 text-tinte-800 dark:bg-tinte-600 dark:text-white" onclick={deactivateNotifications}>
						{texts.pages.profile.notifications.deactivateThisDevice}
					</Button>
					<Button class="min-button bg-tinte-200 hover:bg-accent-300 text-tinte-800 dark:bg-tinte-600 dark:text-white" onclick={deactivateAllNotifications}>
						{texts.pages.profile.notifications.deactivateAllDevices}
					</Button>
				</div>
			{:else if notifPermission === 'denied'}
				<p class="text-sm text-tinte-600 dark:text-tinte-400">
					{texts.pages.profile.notifications.denied}
				</p>
			{:else}
				<!-- Covers two cases:
				     • permission === 'default': user has not been asked yet
				     • permission === 'granted' but no active subscription: user previously
				       deactivated, or the browser subscription was lost (data cleared, etc.) -->
				<p class="text-sm text-tinte-600 dark:text-tinte-400 mb-4">
					{texts.pages.profile.notifications.description}
				</p>
				<Button class="min-button bg-primary-200 hover:bg-primary" onclick={enableNotifications}>
					{texts.pages.profile.notifications.enable}
				</Button>
			{/if}

			<!-- Email Notifications Toggle -->
			{#if emailPrefsLoaded}
				<div class="border-t border-tinte-200 dark:border-tinte-700 mt-6 pt-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-tinte-900 dark:text-white">
								{texts.pages.profile.notifications.emailToggleLabel}
							</p>
							<p class="text-sm text-tinte-600 dark:text-tinte-400 mt-1">
								{texts.pages.profile.notifications.emailToggleDescription}
							</p>
						</div>
						<Toggle
							checked={verified && emailNotificationsEnabled}
							disabled={!verified}
							onchange={toggleEmailNotifications}
							classes={{ span: 'bg-primary-300 peer-checked:bg-safety' }}
						/>
					</div>
					{#if !verified}
						<p class="text-sm text-accent-600 dark:text-accent-400 mt-2">
							{texts.pages.profile.notifications.emailToggleVerifyHint}
						</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
