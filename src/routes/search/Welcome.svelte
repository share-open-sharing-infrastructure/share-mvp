<script lang="ts">
	import { ArrowUpOutline } from 'flowbite-svelte-icons';
	import Button from '$lib/components/ui/Button.svelte';
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';
</script>

<div
	class="
    mx-auto
    mt-2 flex max-w-md flex-col
    items-center justify-center gap-4
    text-center text-lg text-light dark:text-white
    "
>
	<p>{texts.pages.search.welcome}</p>
	<!-- to set bg color assign class="bg-primary-500"-->

	<Button href={resolve('/user/items')} fullWidth class="me-2 mb-2">
		{texts.buttons.offerSomething}
		<ArrowUpOutline class="h-6 w-6" />
	</Button>
	<p>{texts.pages.about.description}</p>
</div>
