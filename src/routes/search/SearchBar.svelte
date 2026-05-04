<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { SearchOutline } from 'flowbite-svelte-icons';
	import { resolve } from '$app/paths';
	import { goto, beforeNavigate } from '$app/navigation';
	import { texts } from '$lib/texts';

	const SEARCH_DELAY_MS = 1000;

	let { q = '' }: { q: string } = $props();

	const browseAllUrl = resolve('/search') + '?q=*';

	let inputValue = $state(q);
	let inputEl = $state<HTMLInputElement | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Cancel any pending debounce when the user navigates via something other than typing.
	beforeNavigate(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
	});

	$effect(() => {
		// Sync input with q prop when it changes externally (e.g. back/forward nav),
		// but not while the user is actively typing.
		if (inputEl !== document.activeElement) {
			inputValue = q;
		}
	});

	function handleInput() {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			const value = inputValue.trim();
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(value ? `/search?q=${encodeURIComponent(value)}` : browseAllUrl);
			inputEl?.focus();
		}, SEARCH_DELAY_MS);
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		const value = inputValue.trim();
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(value ? `/search?q=${encodeURIComponent(value)}` : browseAllUrl);
		inputEl?.focus();
	}

	async function clearSearch() {
		inputValue = '';
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(resolve('/search'));
		inputEl?.focus();
	}
</script>

<form method="GET" action="/search" class="flex gap-2" onsubmit={handleSubmit}>
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
			bind:this={inputEl}
			bind:value={inputValue}
			oninput={handleInput}
			type="search"
			autocomplete="off"
			name="q"
			placeholder={texts.forms.searchPlaceholder}
			class="search-bar pulse-shadow block w-full rounded-lg border border-tinte-300 bg-papier p-2.5 pl-10 pr-8 text-sm text-tinte-900 focus:border-primary focus:ring-primary dark:border-tinte-600 dark:bg-tinte-700 dark:text-white dark:placeholder-tinte-400 [&::-webkit-search-cancel-button]:hidden"
		/>
		{#if inputValue}
			<button
				type="button"
				onclick={clearSearch}
				aria-label="Suche zurücksetzen"
				class="absolute inset-y-0 right-0 flex items-center pr-2.5 text-tinte-400 hover:text-tinte-600 dark:hover:text-tinte-200"
			>
				<svg class="h-4 w-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>
	<Button type="submit" aria-label={texts.buttons.search} class="min-button bg-primary-200 hover:bg-primary shrink-0">
		<SearchOutline class="h-5 w-5" /> {texts.buttons.search}
	</Button>

</form>
