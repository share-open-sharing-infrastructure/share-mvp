<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';


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
	<button
		type="button"
		onclick={onNext}
		class="w-full py-3 px-6 rounded-4xl font-semibold border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
	>
		{texts.onboarding.buttons.configure}
	</button>
	<a
		href={resolve('/search')}
		class="w-full py-3 px-6 rounded-4xl font-semibold text-center border-2 border-tinte-300 dark:border-tinte-600 text-tinte-700 dark:text-tinte-300 hover:border-tinte-500 dark:hover:border-tinte-400 transition-colors"
	>
		{texts.onboarding.buttons.exploreFirst}
	</a>
</div>
