<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';

	let { show }: { show: boolean } = $props();

	let dismissed = $state(true); // start hidden to avoid SSR flash

	onMount(() => {
		dismissed = !!localStorage.getItem('onboarding-prompt-dismissed');
	});

	function dismiss() {
		dismissed = true;
		localStorage.setItem('onboarding-prompt-dismissed', '1');
	}
</script>

{#if show && !dismissed && page.url.pathname !== '/onboarding'}
	<div class="fixed bottom-10 right-4 z-50 w-72 rounded-xl shadow-lg bg-sand border border-tinte-200 dark:bg-tinte-800 dark:border-tinte-700 p-4 flex flex-col gap-3">
		<p class="text-sm text-tinte-700 dark:text-tinte-300 leading-snug">
			{texts.onboardingPrompt.text}
		</p>
		<div class="flex gap-2 justify-end">
			<button
				onclick={dismiss}
				class="text-xs text-tinte-400 hover:text-tinte-600 dark:hover:text-tinte-200 px-2 py-1"
			>
				{texts.onboardingPrompt.dismiss}
			</button>
			<a
				href={resolve('/onboarding')}
				class="text-xs font-semibold text-white bg-primary hover:opacity-90 rounded-lg px-3 py-1"
			>
				{texts.onboardingPrompt.cta}
			</a>
		</div>
	</div>
{/if}
