<script lang="ts">
	import { SearchOutline } from 'flowbite-svelte-icons';
	import { resolve } from '$app/paths';
	import { goto, beforeNavigate } from '$app/navigation';
	import { texts } from '$lib/texts';
	import type { Snippet } from 'svelte';

	const SEARCH_DELAY_MS = 1200;
	const MINIMAL_SEARCHSTRING_LENGTH = 3;

	let { q = '', filterSlot }: { q: string; filterSlot?: Snippet } = $props();

	let inputValue = $state(q);
	let inputEl = $state<HTMLInputElement | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let isDebouncing = $state(false);

	// Cancel any pending debounce when the user navigates via something other than typing.
	beforeNavigate(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		isDebouncing = false;
	});

	$effect(() => {
		// Sync input with q prop when it changes externally (e.g. back/forward nav),
		// but not while the user is actively typing.
		if (inputEl !== document.activeElement) {
			inputValue = q;
		}
	});

	$effect(() => {
		// Initial autofocus only on devices with a precise pointer (desktop). On touch
		// devices focusing would pop the on-screen keyboard on page load (#429/#453).
		if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
			inputEl?.focus();
		}
	});

	async function handleInput() {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = null;

		const value = inputValue.trim();

		if (value.length < MINIMAL_SEARCHSTRING_LENGTH) {
			isDebouncing = false;
			if (q) {
				await goto(resolve('/search'), { keepFocus: true, noScroll: true, replaceState: true });
			}
			return;
		}

		isDebouncing = true;
		debounceTimer = setTimeout(async () => {
			isDebouncing = false;
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(`/search?q=${encodeURIComponent(value)}`, {
				keepFocus: true,
				noScroll: true,
				replaceState: true
			});
		}, SEARCH_DELAY_MS);
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		isDebouncing = false;
		const value = inputValue.trim();
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(value ? `/search?q=${encodeURIComponent(value)}` : resolve('/search'), {
			keepFocus: true,
			noScroll: true
		});
	}

	async function clearSearch() {
		inputValue = '';
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		isDebouncing = false;
		await goto(resolve('/search'), { keepFocus: true, noScroll: true });
	}
</script>

<form method="GET" action="/search" class="flex gap-2" onsubmit={handleSubmit}>
	<div class="relative flex-1">
		
		<input
			bind:this={inputEl}
			bind:value={inputValue}
			oninput={handleInput}
			type="search"
			autocomplete="off"
			name="q"
			placeholder={texts.forms.searchPlaceholder}
			class="search-bar pulse-shadow block w-full rounded-lg border border-tinte-300 bg-papier p-2.5 pl-6.5 pr-14 text-sm text-tinte-900 focus:border-primary focus:ring-primary dark:border-tinte-600 dark:bg-tinte-700 dark:text-white dark:placeholder-tinte-400 [&::-webkit-search-cancel-button]:hidden"
		/>
		<div class="absolute inset-y-0 left-2 flex items-center gap-1 pr-2">
			{#if inputValue}
				<button
					type="button"
					onclick={clearSearch}
					aria-label="Suche zurücksetzen"
					class="flex items-center text-tinte-400 hover:text-tinte-600 dark:hover:text-tinte-200"
				>
					<svg class="h-4 w-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>
		<div class="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
			{#if inputValue && isDebouncing}
				<div class="pointer-events-none flex items-center text-tinte-400">
					<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
						<circle class="opacity-75" cx="12" cy="12" r="10" stroke="green" stroke-width="4"></circle>
					<path class="opacity-100" fill="green" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
					</svg>
				</div>
			{/if}
			<button
				type="submit"
				aria-label={texts.buttons.search}
				class="flex items-center mr-1 hover:cursor-pointer text-tinte-500 hover:text-primary dark:text-tinte-400 dark:hover:text-primary"
			>
				<SearchOutline class="h-6 w-6" />
			</button>
		</div>
	</div>
	{@render filterSlot?.()}
</form>
