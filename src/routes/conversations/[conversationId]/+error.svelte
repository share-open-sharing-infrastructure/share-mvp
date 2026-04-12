<script>
	import { page } from '$app/state';
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';
</script>

<div class="max-w-2xl mx-auto px-4 py-16 text-center">
	{#if page.status === 404}
		<p class="text-lg font-semibold text-gray-700">{texts.errors.conversationNotFound}</p>
		<a href={resolve("/conversations")} class="mt-4 inline-block text-sm text-blue-600 hover:underline">
			← Zurück zu deinen Anfragen
		</a>
	{:else}
		<p class="text-lg font-semibold text-gray-700">{texts.errors.somethingWentWrong}</p>
		<p class="text-sm text-gray-400">{page.status} {page?.error?.message}</p>
	{/if}
</div>
