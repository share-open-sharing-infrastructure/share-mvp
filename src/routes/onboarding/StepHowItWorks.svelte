<script lang="ts">
	import { texts } from '$lib/texts';
	import OnboardingButton from './OnboardingButton.svelte';

	interface Props {
		onNext: () => void;
	}

	let { onNext }: Props = $props();
</script>

<div class="space-y-4">
	<h2 class="text-xl font-bold text-tinte-900 dark:text-white text-center">
		{texts.onboarding.howItWorks.title}
	</h2>

	<div class="space-y-4 mt-6">
		<div class="flex gap-4 items-start">
			<span class="text-2xl mt-0.5">🔍</span>
			<p class="text-tinte-700 dark:text-tinte-300 text-sm leading-relaxed">
				{texts.onboarding.howItWorks.search}
			</p>
		</div>
		<div class="flex gap-4 items-start">
			<span class="text-2xl mt-0.5">📦</span>
			<p class="text-tinte-700 dark:text-tinte-300 text-sm leading-relaxed">
				{texts.onboarding.howItWorks.share}
			</p>
		</div>
		<div class="flex gap-4 items-start">
			<span class="text-2xl mt-0.5">🤝</span>
			<p class="text-tinte-700 dark:text-tinte-300 text-sm leading-relaxed">
				{texts.onboarding.howItWorks.trust}
			</p>
		</div>
		<div class="flex gap-4 items-start">
			<span class="text-2xl mt-0.5">💬</span>
			<p class="text-tinte-700 dark:text-tinte-300 text-sm leading-relaxed">
				{texts.onboarding.howItWorks.contact}
			</p>
		</div>
	</div>
</div>

<div class="mt-10">
	<OnboardingButton onclick={onNext}>{texts.onboarding.buttons.next} →</OnboardingButton>
</div>
