<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { texts } from '$lib/texts';

	let { q = '' }: { q: string } = $props();
</script>

<form method="GET" action="/search" class="flex gap-2">
	<div class="relative flex-1">
		<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
			<svg
				class="h-4 w-4 text-tinte-500 dark:text-tinte-400"
				aria-hidden="true"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 20 20"
			>
				<path
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
				/>
			</svg>
		</div>
		<input
			type="search"
			name="q"
			value={q}
			placeholder={texts.forms.searchPlaceholder}
			class="search-bar pulse-shadow block w-full rounded-lg border border-tinte-300 bg-papier p-2.5 pl-10 text-sm text-tinte-900 focus:border-primary focus:ring-primary dark:border-tinte-600 dark:bg-tinte-700 dark:text-white dark:placeholder-tinte-400"
		/>
	</div>
	<Button type="submit" class="min-button bg-primary shrink-0">
		{texts.buttons.search}
	</Button>
</form>
