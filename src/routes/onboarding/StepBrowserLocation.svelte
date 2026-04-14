<script lang="ts">
	import { texts } from '$lib/texts';
	import OnboardingButton from './OnboardingButton.svelte';

	interface Props {
		onNext: () => void;
	}

	let { onNext }: Props = $props();

	let status = $state<'idle' | 'loading' | 'done' | 'denied'>('idle');

	function request() {
		if (!('geolocation' in navigator)) {
			status = 'denied';
			return;
		}
		status = 'loading';
		navigator.geolocation.getCurrentPosition(
			() => {
				status = 'done';
				setTimeout(onNext, 800);
			},
			() => {
				status = 'denied';
			}
		);
	}
</script>

<div class="text-center space-y-4">
	<div class="text-5xl mb-2">📍</div>
	<h2 class="text-xl font-bold text-gray-900 dark:text-white">
		{texts.onboarding.browserLocation.title}
	</h2>
	<p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
		{texts.onboarding.browserLocation.explanation}
	</p>

	{#if status === 'done'}
		<p class="text-sm text-green-600 dark:text-green-400 font-medium">✓ Standort freigegeben</p>
	{:else if status === 'denied'}
		<p class="text-sm text-gray-500 dark:text-gray-400">
			{texts.onboarding.browserLocation.denied}
		</p>
	{/if}
</div>

<div class="mt-10 flex flex-col gap-2">
	{#if status !== 'done' && status !== 'denied'}
		<OnboardingButton onclick={request} disabled={status === 'loading'}>
			{status === 'loading' ? '…' : texts.onboarding.browserLocation.allow}
		</OnboardingButton>
	{/if}
	<OnboardingButton variant="ghost" onclick={onNext}>
		{status === 'denied' ? texts.onboarding.buttons.next + ' →' : texts.onboarding.buttons.skip}
	</OnboardingButton>
</div>
