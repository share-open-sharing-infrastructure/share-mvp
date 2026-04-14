<script lang="ts">
	import { texts } from '$lib/texts';
	import OnboardingButton from './OnboardingButton.svelte';

	interface Props {
		onNext: () => void;
	}

	let { onNext }: Props = $props();
</script>

<div class="text-center space-y-4">
	<div class="text-5xl mb-2">🌱</div>
	<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
		{texts.onboarding.welcome.title}
	</h1>
	<p class="text-gray-600 dark:text-gray-400 text-base leading-relaxed">
		{texts.onboarding.welcome.subtitle}
	</p>
	<p class="text-sm text-gray-400 dark:text-gray-500 italic">
		{texts.onboarding.welcome.ethos}
	</p>
</div>

<div class="mt-10">
	<OnboardingButton onclick={onNext}>{texts.onboarding.buttons.next} →</OnboardingButton>
</div>
