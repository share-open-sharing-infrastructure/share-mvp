<script lang="ts">
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>{texts.account.deleted.title}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="flex justify-center bg-secondary-100 dark:bg-tinte-900 px-4">
	<div class="max-w-md w-full text-center bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-8 space-y-4">
		<h1 class="text-2xl font-extrabold text-gray-900 dark:text-white">
			{texts.account.deleted.title}
		</h1>
		<p class="text-tinte-700 dark:text-tinte-300">
			{texts.account.deleted.body}
		</p>
		<a
			href={resolve('/')}
			class="inline-block mt-2 py-3 px-6 min-button bg-primary-200 hover:bg-primary text-white font-semibold rounded-xl transition-opacity"
		>
			{texts.account.deleted.backHome}
		</a>
	</div>
</main>
