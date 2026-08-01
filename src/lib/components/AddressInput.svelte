<script lang="ts">
	import { onMount } from 'svelte';
	import debounce from 'debounce';
	import { texts } from '$lib/texts';

	interface Props {
		initialValue?: string;
		initialGeo?: { lon: number; lat: number } | null;
		required?: boolean;
	}

	let { initialValue = '', initialGeo = null, required = true }: Props = $props();

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
	let validationInputEl: HTMLInputElement | undefined = $state(undefined);

	$effect(() => {
		if (!validationInputEl || !required) return;
		if (isValidSelection) {
			validationInputEl.setCustomValidity('');
		} else {
			validationInputEl.setCustomValidity(texts.errors.addressNotSelected);
		}
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
				suggestions = (await res.json()).suggestions;
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

	function handleCityInput(e: Event) {
		// Redundant today, kept deliberately: `bind:value` compiles to `bind_value`, which
		// attaches a *direct* listener on the input (target phase), while this `oninput` is
		// delegated to the mount root (bubble phase) — so `cityText` is already current here.
		// Reading the value off the event keeps the handler self-contained instead of resting on
		// that ordering, which is a Svelte-internal detail, not a documented guarantee.
		cityText = (e.target as HTMLInputElement).value;
		markAsFreeText();
		if (cityText.length > 3) {
			isLoadingGeo = true;
			showSuggestions = false;
			fetchSuggestions(cityText);
		}
	}

	function selectSuggestion(s: { label: string; lon: number; lat: number }) {
		cityText = s.label;
		selectedGeo = { lon: s.lon, lat: s.lat };
		isValidSelection = true;
		showSuggestions = false;
		suggestions = [];
		// Emptying `suggestions` unmounts the <ul> — including the button a keyboard user just
		// activated. Without this, focus would fall back to <body> and strand them at the top of
		// the document. Deliberately synchronous rather than after a tick(): Svelte flushes the
		// unmount later, so focus has already left the button by the time it disappears and there
		// is never a frame with focus on a detached node. Pure no-op on the pointer path, where
		// onmousedown's preventDefault() kept focus on #city all along. Focusing fires no `input`
		// event and touches no state, so neither fetchSuggestions() nor the dropdown is retriggered.
		cityInputEl?.focus();
	}

	// Issue #613: bind:value's hydration guard adopts text the user typed into the SSR-rendered
	// input before the bundle ran, but those keystrokes fired no input event we could hear, so
	// handleCityInput never ran for them and `selectedGeo`/`isValidSelection` still hold their
	// seeded values. Replay that bookkeeping once, after the hydration flush (onMount runs after
	// bind_value has adopted the value), so pre-hydration text is judged exactly as it would have
	// been had it arrived a moment later. Deliberately no fetchSuggestions() here — an unprompted
	// dropdown on page load would be surprising; the user's next keystroke opens it.
	// No-op when the component is mounted client-side (onboarding's StepLocation) or untouched.
	onMount(() => {
		if (cityText === initialValue) return;
		markAsFreeText();
	});

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
		id="city"
		placeholder="z.B. Kleine Bäckerstraße"
		bind:this={cityInputEl}
		bind:value={cityText}
		oninput={handleCityInput}
		autocomplete="off"
		aria-invalid={showCityWarning}
		aria-describedby="city-error"
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
	{#if required}
		<!-- Submit blocker: its setCustomValidity() message is what stops the form, while the
		     *semantics* of the invalid state sit on #city (aria-invalid + aria-describedby), which
		     is where a screen reader lands during normal browsing. This control therefore only
		     needs to speak in one single moment — the blocked submit, where the browser's native
		     constraint validation *focuses it* to anchor its bubble — so its exposure follows
		     exactly the flag that decides whether that moment can happen at all: `isValidSelection`,
		     the same one the $effect above feeds to setCustomValidity(). Valid ⇒ the browser will
		     never focus it, so it leaves the accessibility tree instead of sitting in every
		     rotor/browse-mode pass announcing an error while its own value reads "valid";
		     tabindex={-1} drops it from sequential Tab order but not from that tree, which is why
		     hiding it has to be conditional rather than static. Invalid ⇒ it is exposed and named
		     (aria-label = the visible warning, verbatim) *before* the focus arrives. Deliberately
		     NOT `showCityWarning`: that tracks whether the user should be *told*, and is held back
		     mid-lookup, so it goes false while the blocker is still armed — it would re-hide the
		     very element the browser is about to focus, and could even flip while focus already
		     sits here, once a debounced lookup resolves. No race the other way either: getting back
		     to a valid address means typing in #city or picking a suggestion, so focus has always
		     left this input before `isValidSelection` can flip to true. `aria-hidden` is not a
		     boolean attribute, so the invalid state renders an explicit `aria-hidden="false"`
		     (= not hidden), under SSR and after hydration alike. -->
		<input
			bind:this={validationInputEl}
			type="text"
			value={isValidSelection ? 'valid' : ''}
			class="sr-only"
			tabindex={-1}
			aria-hidden={isValidSelection}
			aria-label={texts.errors.addressNotSelected}
		/>
	{/if}
	<!-- Rendered unconditionally so the live region is already in the accessibility tree when it
	     gets content — a region inserted together with its text is frequently not announced.
	     Polite (role="status"), not alert: #613's onMount can flip the field to invalid with no
	     user action at all, but interrupting mid-keystroke would be worse than waiting. aria-live
	     is spelled out alongside the implicit role value for the same reason as /search's status
	     line: some older screen-reader/browser pairs don't apply it. -->
	<div id="city-error" role="status" aria-live="polite">
		{#if showCityWarning}
			<p class="mt-1 text-xs text-amber-600 dark:text-amber-400">{texts.errors.addressNotSelected}</p>
		{/if}
	</div>
</div>
