<script>
	import { Button } from 'flowbite-svelte';
	import { ArrowUpOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
</script>

<div
	class="
    mx-auto
    mt-2 flex max-w-md flex-col
    items-center justify-center gap-4
    text-center text-lg text-gray-600 dark:text-white
    "
>
	<p>{texts.pages.search.welcome}</p>
	<!-- to set bg color assign class="bg-primary-500"-->

	<Button class="me-2 mb-2 w-full min-button" href="/profile"
		>{texts.buttons.offerSomething}
		<ArrowUpOutline class="me-2 h-6 w-6" />
	</Button>
	<p>{texts.pages.about.description}</p>
</div>
