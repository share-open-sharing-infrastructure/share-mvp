<script lang="ts">
	import { onDestroy } from 'svelte';
	import { texts } from '$lib/texts';
	import { setupPushSubscription } from '$lib/utils/pushSubscription';
	import Button from '$lib/components/ui/Button.svelte';

	interface Props {
		onNext: () => void;
	}

	let { onNext }: Props = $props();

	let status = $state<'idle' | 'loading' | 'granted' | 'denied'>('idle');

	// Guards against state mutations and the auto-advance timer firing after the component
	// is destroyed — e.g. if the user navigates away while the permission dialog is still open.
	let cancelled = false;
	let advanceTimer: ReturnType<typeof setTimeout> | null = null;

	onDestroy(() => {
		cancelled = true;
		if (advanceTimer) clearTimeout(advanceTimer);
	});

	async function request() {
		if (!('Notification' in window)) {
			status = 'denied';
			return;
		}
		status = 'loading';
		try {
			const permission = await Notification.requestPermission();
			if (cancelled) return;
			if (permission === 'granted') {
				await setupPushSubscription();
				if (cancelled) return;
				status = 'granted';
				advanceTimer = setTimeout(onNext, 800);
			} else {
				status = 'denied';
			}
		} catch {
			if (cancelled) return;
			status = 'denied';
		}
	}
</script>

<div class="text-center space-y-4">
	<div class="text-5xl mb-2">🔔</div>
	<h2 class="text-xl font-bold text-tinte-900 dark:text-white">
		{texts.onboarding.pushNotifications.title}
	</h2>
	<p class="text-sm text-tinte-600 dark:text-tinte-400 leading-relaxed">
		{texts.onboarding.pushNotifications.explanation}
	</p>

	{#if status === 'granted'}
		<p class="text-sm text-green-600 dark:text-green-400 font-medium">✓ {texts.onboarding.pushNotifications.allow}</p>
	{:else if status === 'denied'}
		<p class="text-sm text-tinte-500 dark:text-tinte-400">{texts.onboarding.pushNotifications.denied}</p>
	{/if}
</div>

<div class="mt-10 flex flex-col gap-2">
	{#if status !== 'granted' && status !== 'denied'}
		<Button size="lg" fullWidth onclick={request} loading={status === 'loading'}>
			{texts.onboarding.pushNotifications.allow}
		</Button>
	{/if}
	<Button variant="ghost" fullWidth onclick={onNext}>
		{status === 'denied' ? texts.onboarding.buttons.next + ' →' : texts.onboarding.buttons.skip}
	</Button>
</div>
