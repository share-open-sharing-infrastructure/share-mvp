<script lang="ts">
	import { Alert, Button } from 'flowbite-svelte';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
</script>

<svelte:head>
	<title>{texts.legal.locked.pageTitle}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto max-w-xl px-4 py-12 space-y-6">
	<h1 class="text-3xl font-bold tracking-tight text-tinte-900 dark:text-white">
		{texts.legal.locked.pageTitle}
	</h1>

	<Alert color="yellow" class="text-sm">{texts.legal.locked.body}</Alert>

	<!-- Self-recovery: accepting clears the lock (see /legal/accept + the unlock hook). -->
	<div class="space-y-2">
		<p class="text-tinte-700 dark:text-tinte-300">{texts.legal.locked.reconsiderPrompt}</p>
		<Button href={resolve('/legal/accept')} pill class="cursor-pointer bg-primary font-semibold text-white hover:bg-primary-600">
			{texts.legal.locked.acceptInstead}
		</Button>
	</div>

	<p class="text-tinte-700 dark:text-tinte-300">
		{texts.legal.locked.contactPrompt}
		<a href={`mailto:${texts.legal.locked.contactEmail}`} class="text-primary hover:underline">
			{texts.legal.locked.contactEmail}
		</a>
	</p>

	<form method="POST" action="/auth/logout">
		<Button type="submit" color="light" size="sm" class="cursor-pointer">
			{texts.legal.locked.logout}
		</Button>
	</form>
</div>
