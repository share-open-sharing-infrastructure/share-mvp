<script lang="ts">
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';
	import { HeartOutline } from 'flowbite-svelte-icons';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import Button from '$lib/components/ui/Button.svelte';
</script>

<SeoHead title={texts.account.deleted.title} robots="noindex, nofollow" />

<main class="flex justify-center bg-secondary-100 dark:bg-tinte-900 px-4 py-16 sm:py-24">
	<div class="max-w-md w-full text-center bg-sand border border-tinte-200 rounded-2xl shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-8 sm:p-10 space-y-5">
		<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
			<HeartOutline class="h-8 w-8 text-primary" />
		</div>
		<h1 class="text-2xl font-extrabold text-gray-900 dark:text-white">
			{texts.account.deleted.title}
		</h1>
		<p class="text-tinte-700 dark:text-tinte-300">
			{texts.account.deleted.body}
		</p>
		<p class="text-sm text-tinte-500 dark:text-tinte-400">
			{texts.account.deleted.secondary}
		</p>
		<Button href={resolve('/')} size="lg" class="mt-2">
			{texts.account.deleted.backHome}
		</Button>
	</div>
</main>
