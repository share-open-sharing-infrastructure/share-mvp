<script lang="ts">
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import OnboardingButton from './OnboardingButton.svelte';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import CustomAlert from '$lib/components/CustomAlert.svelte';

	interface Props {
		onNext: () => void;
	}

	let { onNext }: Props = $props();

	let errorMessage = $state<string | undefined>(undefined);
</script>

<div class="space-y-4">
	<h2 class="text-xl font-bold text-gray-900 dark:text-white text-center">
		{texts.onboarding.location.title}
	</h2>
	<p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
		{texts.onboarding.location.explanation}
	</p>

	{#if errorMessage}
		<CustomAlert type="error" message={errorMessage} />
	{/if}

	<form
		method="POST"
		action="?/saveLocation"
		class="space-y-4 mt-2"
		use:enhance={() =>
			({ result }) => {
				if (result.type === 'success') {
					onNext();
				} else if (result.type === 'failure') {
					errorMessage = (result.data?.message as string) ?? texts.errors.somethingWentWrong;
				}
			}}
	>
		<AddressInput />

		<div class="flex flex-col gap-2 pt-2">
			<OnboardingButton type="submit">{texts.onboarding.buttons.next} →</OnboardingButton>
			<OnboardingButton variant="ghost" onclick={onNext}>{texts.onboarding.buttons.skip}</OnboardingButton>
		</div>
	</form>
</div>
