<script lang="ts">
	import debounce from 'debounce';
	import { texts } from '$lib/texts';

	interface Props {
		initialValue?: string;
		initialGeo?: { lon: number; lat: number } | null;
		required?: boolean;
		/**
		 * DOM id for the city input. Pass it when the `<label for>` lives outside this component
		 * (as on the profile page). Left unset, every instance derives its own id, so two
		 * AddressInputs on one page cannot collide — neither on the input nor on its error region.
		 */
		id?: string;
	}

	let { initialValue = '', initialGeo = null, required = true, id }: Props = $props();

	const uid = $props.id();
	const cityId = $derived(id ?? `${uid}-city`);
	const cityErrorId = $derived(`${cityId}-error`);

	// svelte-ignore state_referenced_locally
	let cityText = $state(initialValue);
	let suggestions: { label: string; lon: number; lat: number }[] = $state([]);
	let isLoadingGeo = $state(false);
	// svelte-ignore state_referenced_locally
	let selectedGeo: { lon: number; lat: number } | null = $state(initialGeo);
	let isValidSelection = $state(true);
	let showSuggestions = $state(false);
	let cityInputEl: HTMLInputElement | undefined = $state(undefined);
	let suggestionsEl: HTMLUListElement | undefined = $state(undefined);

	// Native constraint validation lives on the city input itself: setCustomValidity() is what
	// blocks the submit, and the browser anchors its bubble to the field the user actually typed
	// in — the same element that carries aria-invalid and aria-describedby, so the native, the
	// visual and the assistive state cannot disagree. Sole writer of the message, so dropping
	// `required` (address optional) clears whatever a previous run left behind.
	$effect(() => {
		if (!cityInputEl) return;
		cityInputEl.setCustomValidity(
			required && !isValidSelection ? texts.errors.addressNotSelected : ''
		);
	});

	const fetchSuggestions = debounce(async (q: string) => {
		if (q.length < 3) {
			suggestions = [];
			isLoadingGeo = false;
			return;
		}
		try {
			const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
			if (res.ok) {
				const fetched: typeof suggestions = (await res.json()).suggestions;
				// ORS can return two features with the same formatted label. They would be
				// indistinguishable in the dropdown and collide as {#each} keys, so keep the first.
				suggestions = fetched.filter(
					(s, i, arr) => arr.findIndex((o) => o.label === s.label) === i
				);
				showSuggestions = suggestions.length > 0;
			}
		} catch {
			suggestions = [];
		}
		isLoadingGeo = false;
	}, 1000);

	/**
	 * The city field holds free text that was *not* picked from the suggestion list: it carries
	 * no coordinates, so it has to fail the "choose an address from the search" guard. An empty
	 * field stays valid — the address is optional, `required` only means "if you type something,
	 * it has to resolve".
	 */
	function markAsFreeText() {
		selectedGeo = null;
		isValidSelection = cityText.length === 0;
	}

	// Issue #613: the setter half of the city field's function binding, and the single place the
	// free-text bookkeeping happens. Svelte calls it for every value the DOM hands back — real
	// keystrokes and text typed into the SSR-rendered input before hydration alike — so
	// pre-hydration input is judged exactly as if it had been typed a moment later, with no
	// mount-time replay. Deliberately no fetchSuggestions() here: an unprompted dropdown on page
	// load would be surprising, so the fetch stays in oninput, which only real keystrokes fire.
	function setCityText(v: string) {
		cityText = v;
		markAsFreeText();
	}

	// Only the suggestion lookup; reads the query off the event so it stays independent of the
	// binding's setter above. State bookkeeping lives in setCityText.
	function handleCityInput(e: Event) {
		const q = (e.target as HTMLInputElement).value;
		if (q.length > 3) {
			isLoadingGeo = true;
			showSuggestions = false;
			fetchSuggestions(q);
		}
	}

	function selectSuggestion(s: { label: string; lon: number; lat: number }) {
		cityText = s.label;
		selectedGeo = { lon: s.lon, lat: s.lat };
		isValidSelection = true;
		showSuggestions = false;
		suggestions = [];
		// Emptying `suggestions` unmounts the <ul> — including the button a keyboard user just
		// activated, whose focus would otherwise fall back to <body> and strand them at the top of
		// the document. Deliberately synchronous rather than after a tick(): focus has to leave the
		// button before it is detached, so there is never a frame with focus on a detached node.
		// Pure no-op on the pointer path, where onmousedown's preventDefault() kept focus in the
		// city input all along. Focusing fires no `input` event and touches no state, so neither
		// fetchSuggestions() nor the dropdown is retriggered.
		cityInputEl?.focus();
	}

	// Single source of truth for "the address is unusable and the user needs to be told": drives
	// the visible warning *and* `aria-invalid`, so the screen-reader state can never disagree
	// with what is on screen. Held back while a lookup runs or the dropdown is open — the user is
	// mid-selection there, and flagging every keystroke as an error would be pure noise.
	let showCityWarning = $derived(
		cityText.length > 0 && !isValidSelection && !isLoadingGeo && !showSuggestions
	);

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
		id={cityId}
		placeholder="z.B. Kleine Bäckerstraße"
		bind:this={cityInputEl}
		bind:value={() => cityText, setCityText}
		oninput={handleCityInput}
		autocomplete="off"
		aria-invalid={showCityWarning}
		aria-describedby={cityErrorId}
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
			{#each suggestions as s (s.label)}
				<li>
					<!-- Both handlers on purpose: keyboard activation fires `click`, never
					     `mousedown`, so without onclick a keyboard user could never pick a
					     suggestion — the only route back to a valid selection. onmousedown stays
					     for its preventDefault (keeps focus in the input on a pointer pick). A
					     mouse click does not run both: selectSuggestion() empties `suggestions`,
					     so the button is gone before `click` would be dispatched — and even if a
					     browser did dispatch it, selectSuggestion() is idempotent (same
					     assignments, no fetch, no submit). -->
					<button
						type="button"
						class="w-full text-left px-3 py-2 text-sm text-tinte-800 dark:text-tinte-200 hover:bg-tinte-100 dark:hover:bg-tinte-700"
						onmousedown={(e) => { e.preventDefault(); selectSuggestion(s); }}
						onclick={() => selectSuggestion(s)}
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
	<!-- Rendered unconditionally so the live region is already in the accessibility tree when it
	     gets content — a region inserted together with its text is frequently not announced.
	     Polite (role="status"), not alert: #613 means the field can turn invalid with no user
	     action at all (text adopted during hydration), but interrupting mid-keystroke would be
	     worse than waiting. aria-live is spelled out alongside the implicit role value for the
	     same reason as /search's status line: some older screen-reader/browser pairs don't
	     apply it. -->
	<div id={cityErrorId} role="status" aria-live="polite">
		{#if showCityWarning}
			<p class="mt-1 text-xs text-amber-600 dark:text-amber-400">{texts.errors.addressNotSelected}</p>
		{/if}
	</div>
</div>
