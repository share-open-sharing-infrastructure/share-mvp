<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import Button from '$lib/components/ui/Button.svelte';

	interface Props {
		onNext: () => void;
	}

	let { onNext }: Props = $props();
</script>

<div class="text-center space-y-4">
	<h1 class="text-2xl font-bold text-tinte-900 dark:text-white">
		{texts.onboarding.welcome.title}
	</h1>
	<img src="/AllerLeih.png" alt="AllerLeih" class="h-16 mx-auto my-4" />
	
	<p class="text-tinte-600 dark:text-tinte-400 text-base leading-relaxed">
		{texts.onboarding.welcome.body}
	</p>
</div>

<div class="mt-5 flex flex-col gap-3">
	<Button size="lg" fullWidth onclick={onNext}>
		{texts.onboarding.buttons.configure}
	</Button>
	<Button href={resolve('/search')} variant="secondary" size="lg" fullWidth>
		{texts.onboarding.buttons.exploreFirst}
	</Button>
</div>
