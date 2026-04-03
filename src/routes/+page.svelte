<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<section class="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-8">
	<div>
		<h1 class="text-4xl font-bold text-gray-900 dark:text-white">{texts.names.app}</h1>
		<p class="mt-4 text-xl text-gray-600 dark:text-gray-400">{texts.pages.landing.tagline}</p>
	</div>

	<div class="flex flex-col sm:flex-row gap-4">
		<Button href="/search" class="min-button bg-primary" size="xl" color="primary">
			{texts.pages.landing.searchButton}
		</Button>

		{#if data.currentUser}
			<Button href="/user/items" size="xl" class="min-button bg-primary">
				{texts.pages.landing.lendButton}
			</Button>
		{/if}
	</div>

	{#if !data.currentUser}
		<p class="text-sm text-gray-500 dark:text-gray-400">
			<a href={resolve('/auth/register')} class="text-primary-600 hover:underline">{texts.auth.register}</a>
			{texts.pages.landing.or}
			<a href={resolve('/auth/login')} class="text-primary-600 hover:underline">{texts.nav.login}</a>
			{texts.pages.landing.registerCta}
		</p>
	{/if}
</section>
