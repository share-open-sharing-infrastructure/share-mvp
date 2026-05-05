<script lang="ts">
	import debounce from 'debounce';

	interface Props {
		initialValue?: string;
	}

	let { initialValue = '' }: Props = $props();

	// svelte-ignore state_referenced_locally
	let cityText = $state(initialValue);
	let suggestions: { label: string; lon: number; lat: number }[] = $state([]);
	let isLoadingGeo = $state(false);
	let selectedGeo: { lon: number; lat: number } | null = $state(null);
	let showSuggestions = $state(false);
	let cityInputEl: HTMLInputElement | undefined = $state(undefined);
	let suggestionsEl: HTMLUListElement | undefined = $state(undefined);

	const fetchSuggestions = debounce(async (q: string) => {
		if (q.length < 3) {
			suggestions = [];
			isLoadingGeo = false;
			return;
		}
		try {
			const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
			if (res.ok) {
				suggestions = (await res.json()).suggestions;
				showSuggestions = suggestions.length > 0;
			}
		} catch {
			suggestions = [];
		}
		isLoadingGeo = false;
	}, 1000);

	function handleCityInput(e: Event) {
		cityText = (e.target as HTMLInputElement).value;
		selectedGeo = null;
		if (cityText.length > 3) {
			isLoadingGeo = true;
			showSuggestions = false;
			fetchSuggestions(cityText);
		}
	}

	function selectSuggestion(s: { label: string; lon: number; lat: number }) {
		cityText = s.label;
		selectedGeo = { lon: s.lon, lat: s.lat };
		showSuggestions = false;
		suggestions = [];
	}

	function handleWindowMousedown(e: MouseEvent) {
		if (
			!cityInputEl?.contains(e.target as Node) &&
			!suggestionsEl?.contains(e.target as Node)
		) {
			showSuggestions = false;
		}
	}
</script>

<svelte:window onmousedown={handleWindowMousedown} />

<div class="relative">
	<input
		type="text"
		name="city"
		id="city"
		bind:this={cityInputEl}
		value={cityText}
		oninput={handleCityInput}
		autocomplete="off"
		class="w-full px-3 py-2 bg-papier border border-tinte-300 rounded-lg text-tinte-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-tinte-700 dark:border-tinte-600 dark:text-white pr-8"
	/>
	{#if isLoadingGeo}
		<span class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
			<svg class="animate-spin h-4 w-4 text-tinte-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-75" cx="12" cy="12" r="10" stroke="green" stroke-width="4"></circle>
				<path class="opacity-100" fill="green" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
			</svg>
		</span>
	{/if}
	{#if showSuggestions}
		<ul
			bind:this={suggestionsEl}
			class="absolute z-10 mt-1 w-full bg-sand border border-tinte-200 rounded-lg shadow-lg dark:bg-tinte-800 dark:border-tinte-600 max-h-60 overflow-auto"
		>
			{#each suggestions as s (suggestions.indexOf(s))}
				<li>
					<button
						type="button"
						class="w-full text-left px-3 py-2 text-sm text-tinte-800 dark:text-tinte-200 hover:bg-tinte-100 dark:hover:bg-tinte-700"
						onmousedown={(e) => { e.preventDefault(); selectSuggestion(s); }}
					>
						{s.label}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	{#if selectedGeo}
		<input type="hidden" name="geolocation_lon" value={selectedGeo.lon} />
		<input type="hidden" name="geolocation_lat" value={selectedGeo.lat} />
	{/if}
</div>
