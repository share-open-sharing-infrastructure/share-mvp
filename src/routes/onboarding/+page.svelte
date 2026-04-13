<script lang="ts">
	import StepWelcome from './StepWelcome.svelte';
	import StepHowItWorks from './StepHowItWorks.svelte';
	import StepLocation from './StepLocation.svelte';
	import StepContact from './StepContact.svelte';
	import StepBrowserLocation from './StepBrowserLocation.svelte';
	import StepPushNotifications from './StepPushNotifications.svelte';
	import StepDone from './StepDone.svelte';

	let { data } = $props();

	let step = $state(1);
	const totalSteps = 7;

	function next() {
		if (step < totalSteps) step++;
	}

	function back() {
		if (step > 1) step--;
	}
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 py-10">
	<div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 sm:p-10">

		<!-- Back button -->
		<div class="h-6 mb-4">
			{#if step > 1}
				<button
					type="button"
					onclick={back}
					class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
				>
					← Zurück
				</button>
			{/if}
		</div>

		<!-- Progress dots -->
		<div class="flex justify-center gap-2 mb-8">
			{#each Array.from({ length: totalSteps }, (_, i) => i) as i (i)}
				<div
					class="h-2 rounded-full transition-all duration-300 {i + 1 === step
						? 'w-6 bg-primary'
						: i + 1 < step
							? 'w-2 bg-primary opacity-40'
							: 'w-2 bg-gray-300 dark:bg-gray-600'}"
				></div>
			{/each}
		</div>

		{#if step === 1}
			<StepWelcome onNext={next} />
		{:else if step === 2}
			<StepHowItWorks onNext={next} />
		{:else if step === 3}
			<StepLocation onNext={next} />
		{:else if step === 4}
			<StepContact onNext={next} />
		{:else if step === 5}
			<StepBrowserLocation onNext={next} />
		{:else if step === 6}
			<StepPushNotifications onNext={next} />
		{:else if step === 7}
			<StepDone inviteUrl={data.inviteUrl} />
		{/if}

	</div>
</div>
