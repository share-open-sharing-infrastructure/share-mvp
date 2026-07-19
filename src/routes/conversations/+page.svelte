<script lang="ts">
	import { resolve } from '$app/paths';
	import { MessageDotsOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import Button from '$lib/components/ui/Button.svelte';
</script>

<SeoHead title={texts.seo.conversations.title} robots="noindex, nofollow" />

<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
	<div class="w-14 h-14 rounded-2xl bg-tinte-100 dark:bg-tinte-800 flex items-center justify-center">
		<MessageDotsOutline class="w-7 h-7 text-tinte-400 dark:text-tinte-500" />
	</div>
	<div class="flex flex-col gap-1">
		<p class="text-sm font-semibold text-tinte-700 dark:text-tinte-200">Kein Gespräch ausgewählt</p>
		<p class="text-xs text-tinte-400 dark:text-tinte-500 max-w-48">
			Wähle eine Unterhaltung aus der Liste oder starte eine neue über die Suche.
		</p>
	</div>
	<Button href={resolve('/search')}>Zur Suche</Button>
</div>
