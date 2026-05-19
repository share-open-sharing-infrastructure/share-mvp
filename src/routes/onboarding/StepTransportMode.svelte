<script lang="ts">
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import OnboardingButton from './OnboardingButton.svelte';
	import TransportModeIcon from '$lib/components/TransportModeIcon.svelte';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	interface Props {
		onNext: () => void;
		preferredTransportMode?: TransportMode;
	}

	let { onNext, preferredTransportMode }: Props = $props();

	let selected = $state<TransportMode>(preferredTransportMode ?? 'bicycle');
</script>

<div class="space-y-4">
	<h2 class="text-xl font-bold text-tinte-900 dark:text-white text-center">
		{texts.onboarding.transportMode.title}
	</h2>
	<p class="text-sm text-tinte-600 dark:text-tinte-400 leading-relaxed">
		{texts.onboarding.transportMode.explanation}
	</p>

	<form
		method="POST"
		action="?/saveTransportMode"
		class="space-y-5 mt-2"
		use:enhance={() => () => { onNext(); }}
	>
		<input type="hidden" name="mode" value={selected} />

		<div class="flex justify-center gap-3">
			{#each (['foot', 'bicycle', 'car'] as TransportMode[]) as mode (mode)}
				<button
					type="button"
					onclick={() => (selected = mode)}
					class="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 transition-colors cursor-pointer
						{selected === mode
						? 'border-primary bg-primary-50 dark:bg-primary-900/20 text-primary dark:text-primary-300'
						: 'border-tinte-200 dark:border-tinte-600 text-tinte-600 dark:text-tinte-300 hover:border-tinte-400 dark:hover:border-tinte-400'}"
				>
					<TransportModeIcon {mode} class="h-6 w-6" />
					<span class="text-sm font-medium">{texts.pages.search.transportModes[mode]}</span>
				</button>
			{/each}
		</div>

		<div class="flex flex-col gap-2 pt-2">
			<OnboardingButton type="submit">{texts.onboarding.buttons.next} →</OnboardingButton>
		</div>
	</form>
</div>
