<script lang="ts">
	import { texts } from '$lib/texts';
	import { Toggle } from 'flowbite-svelte';
	import { onMount } from 'svelte';
	import {
		setupPushSubscription,
		teardownPushSubscription,
		teardownAllPushSubscriptions,
	} from '$lib/utils/pushSubscription';
	import { getClientPB } from '$lib/client-pb';
	import { pushToast } from '$lib/stores/toast.svelte';

	let { userId }: { userId: string } = $props();

	// null         → not yet read from browser; resolved in onMount.
	// 'unsupported' → Notification (push) API unavailable in this browser.
	let notifPermission = $state<NotificationPermission | 'unsupported' | null>(null);

	// Whether to show the push-subscription controls. Email notifications work without
	// push, so the section still renders (heading + email toggle) when push is absent.
	let pushSupported = $derived(notifPermission !== null && notifPermission !== 'unsupported');

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

	// Guards against re-entrancy: the toggle stays disabled while a subscribe/unsubscribe
	// round-trip is in flight so a double-tap can't race two overlapping operations.
	let busy = $state(false);

	/** The browser's actual subscription state — the source of truth we report against,
	 *  since setup/teardown swallow their own errors and can't be trusted to have worked. */
	async function hasActiveSubscription(): Promise<boolean> {
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
		const registration = await navigator.serviceWorker.ready;
		return (await registration.pushManager.getSubscription()) !== null;
	}

	/** Single toggle for push on this device: subscribe when turning on (asking for
	 *  permission if needed), unsubscribe when turning off. The toast + toggle state
	 *  reflect the real subscription afterwards, not an optimistic assumption. */
	async function togglePush() {
		if (busy) return;
		const wantOn = !isPushSubscribed;
		busy = true;
		try {
			if (wantOn) {
				const permission = await Notification.requestPermission();
				notifPermission = permission;
				if (permission !== 'granted') {
					// 'denied' → blocked in the browser; 'default' → prompt dismissed, nothing
					// changed, so stay silent rather than claim it was blocked.
					if (permission === 'denied') {
						pushToast('error', texts.pages.profile.notifications.denied);
					}
					return;
				}
				await setupPushSubscription();
			} else {
				await teardownPushSubscription();
			}
			isPushSubscribed = await hasActiveSubscription();
			const ok = isPushSubscribed === wantOn;
			pushToast(
				ok ? 'success' : 'error',
				ok ? texts.success.dataUpdated : texts.errors.somethingWentWrong
			);
		} finally {
			busy = false;
		}
	}

	async function deactivateAllNotifications() {
		if (busy) return;
		busy = true;
		try {
			await teardownAllPushSubscriptions();
			isPushSubscribed = await hasActiveSubscription();
			pushToast(
				isPushSubscribed ? 'error' : 'success',
				isPushSubscribed ? texts.errors.somethingWentWrong : texts.success.dataUpdated
			);
		} finally {
			busy = false;
		}
	}

	async function toggleEmailNotifications() {
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
			pushToast('success', texts.success.dataUpdated);
		} catch {
			// Revert on failure and tell the user the auto-save didn't stick.
			emailNotificationsEnabled = !newValue;
			pushToast('error', texts.errors.somethingWentWrong);
		}
	}
</script>

{#if pushSupported || emailPrefsLoaded}
	<div class="bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-6 sm:p-8">
		<h2 class="text-lg font-semibold text-tinte-900 dark:text-white mb-4">
			{texts.pages.profile.notifications.sectionTitle}
		</h2>
		<!-- Push on this device — same toggle styling as the e-mail preference below. -->
		{#if pushSupported}
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-tinte-900 dark:text-white">
						{texts.pages.profile.notifications.pushToggleLabel}
					</p>
					<p class="text-sm text-tinte-600 dark:text-tinte-400 mt-1">
						{notifPermission === 'denied'
							? texts.pages.profile.notifications.denied
							: texts.pages.profile.notifications.description}
					</p>
				</div>
				<Toggle
					checked={isPushSubscribed}
					disabled={notifPermission === 'denied' || busy}
					onchange={togglePush}
					aria-label={texts.pages.profile.notifications.pushToggleLabel}
					classes={{ span: 'bg-primary-300 peer-checked:bg-safety' }}
				/>
			</div>
			{#if isPushSubscribed}
				<button
					type="button"
					onclick={deactivateAllNotifications}
					disabled={busy}
					class="mt-3 text-sm font-medium text-primary hover:text-primary-800 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed dark:text-primary-400 dark:hover:text-primary-300"
				>
					{texts.pages.profile.notifications.deactivateAllDevices}
				</button>
			{/if}
		{/if}

		<!-- Email Notifications Toggle — works regardless of push support -->
		{#if emailPrefsLoaded}
			<div
				class="flex items-center justify-between"
				class:border-t={pushSupported}
				class:border-tinte-200={pushSupported}
				class:dark:border-tinte-700={pushSupported}
				class:mt-6={pushSupported}
				class:pt-6={pushSupported}
			>
				<div>
					<p class="text-sm font-medium text-tinte-900 dark:text-white">
						{texts.pages.profile.notifications.emailToggleLabel}
					</p>
					<p class="text-sm text-tinte-600 dark:text-tinte-400 mt-1">
						{texts.pages.profile.notifications.emailToggleDescription}
					</p>
				</div>
				<Toggle
					checked={emailNotificationsEnabled}
					onchange={toggleEmailNotifications}
					aria-label={texts.pages.profile.notifications.emailToggleLabel}
					classes={{ span: 'bg-primary-300 peer-checked:bg-safety' }}
				/>
			</div>
		{/if}
	</div>
{/if}
