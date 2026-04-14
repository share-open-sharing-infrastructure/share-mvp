<script lang="ts">
	import { texts } from '$lib/texts';
	import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';
	import OnboardingButton from './OnboardingButton.svelte';

	interface Props {
		onNext: () => void;
	}

	let { onNext }: Props = $props();

	let status = $state<'idle' | 'loading' | 'granted' | 'denied'>('idle');

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

	async function setupPushSubscription() {
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
		try {
			const registration = await navigator.serviceWorker.ready;
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
	}

	async function request() {
		if (!('Notification' in window)) {
			status = 'denied';
			return;
		}
		status = 'loading';
		const permission = await Notification.requestPermission();
		if (permission === 'granted') {
			await setupPushSubscription();
			status = 'granted';
			setTimeout(onNext, 800);
		} else {
			status = 'denied';
		}
	}
</script>

<div class="text-center space-y-4">
	<div class="text-5xl mb-2">🔔</div>
	<h2 class="text-xl font-bold text-gray-900 dark:text-white">
		{texts.onboarding.pushNotifications.title}
	</h2>
	<p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
		{texts.onboarding.pushNotifications.explanation}
	</p>

	{#if status === 'granted'}
		<p class="text-sm text-green-600 dark:text-green-400 font-medium">✓ Benachrichtigungen aktiviert</p>
	{:else if status === 'denied'}
		<p class="text-sm text-gray-500 dark:text-gray-400">Benachrichtigungen nicht aktiviert.</p>
	{/if}
</div>

<div class="mt-10 flex flex-col gap-2">
	{#if status !== 'granted' && status !== 'denied'}
		<OnboardingButton onclick={request} disabled={status === 'loading'}>
			{status === 'loading' ? '…' : texts.onboarding.pushNotifications.allow}
		</OnboardingButton>
	{/if}
	<OnboardingButton variant="ghost" onclick={onNext}>
		{status === 'denied' ? texts.onboarding.buttons.next + ' →' : texts.onboarding.buttons.skip}
	</OnboardingButton>
</div>
