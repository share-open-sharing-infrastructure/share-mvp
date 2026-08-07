<script lang="ts">
	import { texts } from '$lib/texts';
	import { Toggle } from 'flowbite-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { onMount } from 'svelte';
	import {
		setupPushSubscription,
		teardownPushSubscription,
		teardownAllPushSubscriptions,
	} from '$lib/utils/pushSubscription';
	import { pushToast } from '$lib/stores/toast.svelte';

	// #607 review split: moved verbatim out of NotificationSettings.svelte, which is now a
	// thin wrapper around this + EmailNotificationForm.svelte (co-located, single-use — the
	// push code is unrelated to #607 and untouched here beyond the `pushSupported` handoff
	// below, which EmailNotificationForm's top divider needs now that the two live in
	// separate component scopes).
	let { pushSupported = $bindable(false) }: { pushSupported?: boolean } = $props();

	// null         → not yet read from browser; resolved in onMount.
	// 'unsupported' → Notification (push) API unavailable in this browser.
	let notifPermission = $state<NotificationPermission | 'unsupported' | null>(null);

	// Was a plain $derived before the split; now mirrored into the bindable prop above so
	// EmailNotificationForm can react to it too.
	$effect(() => {
		pushSupported = notifPermission !== null && notifPermission !== 'unsupported';
	});

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
</script>

<!-- Push on this device — same toggle styling as the e-mail/digest preferences below. -->
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
		<Button variant="link" onclick={deactivateAllNotifications} disabled={busy} class="mt-3">
			{texts.pages.profile.notifications.deactivateAllDevices}
		</Button>
	{/if}
{/if}
