<script lang="ts">
	import { texts } from '$lib/texts';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import TransportModeIcon from '$lib/components/TransportModeIcon.svelte';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	/**
	 * "Standort & Mobilität" section body of the profile settings form: address input
	 * and preferred-transport-mode picker. Owns the picker's selection state and renders
	 * it as the hidden `preferredTransportMode` form field — must sit inside the page's
	 * #profile-settings-form, like the other section components.
	 */
	interface Props {
		city: string;
		initialTransportMode: TransportMode;
		ondirty?: () => void;
	}

	let { city, initialTransportMode, ondirty }: Props = $props();

	let selectedTransportMode = $state<TransportMode>(initialTransportMode);
</script>

<div class="mt-4 space-y-4">
	<!-- #address is a deep-link target from the item-page lending-requirement CTA. -->
	<div id="address" class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 scroll-mt-28">
		<label
			for="city"
			class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white"
		>
			{texts.ui.location}
		</label>
		<div class="sm:flex-1">
			<AddressInput initialValue={city} />
			<p class="text-sm text-tinte-600 dark:text-tinte-400 mb-2 mt-2">
				{texts.pages.userProfile.addressNote}
			</p>
			<p class="text-xs text-tinte-500 dark:text-tinte-400">
				{texts.pages.userProfile.addressHint}
			</p>
		</div>
	</div>

	<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
		<div class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white">
			{texts.pages.profile.transportModeLabel}
		</div>
		<div>
			<div class="flex gap-2">
				<input type="hidden" name="preferredTransportMode" value={selectedTransportMode} />
				{#each ['foot', 'bicycle', 'car'] as TransportMode[] as mode (mode)}
					<button
						type="button"
						onclick={() => {
							selectedTransportMode = mode;
							ondirty?.();
						}}
						class="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 transition-colors cursor-pointer
							{selectedTransportMode === mode
							? 'border-primary bg-primary-50 dark:bg-primary-900/20 text-primary dark:text-primary-300'
							: 'border-tinte-200 dark:border-tinte-600 text-tinte-600 dark:text-tinte-300 hover:border-tinte-400 dark:hover:border-tinte-400'}"
					>
						<TransportModeIcon {mode} class="h-5 w-5" />
						<span class="text-xs font-medium">{texts.pages.search.transportModes[mode]}</span>
					</button>
				{/each}
			</div>
			<p class="text-xs text-tinte-500 dark:text-tinte-400 mt-2">
				{texts.pages.profile.transportModeNote}
			</p>
		</div>
	</div>
</div>
