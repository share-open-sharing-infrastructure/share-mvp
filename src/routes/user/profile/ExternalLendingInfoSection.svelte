<script lang="ts">
	import { texts } from '$lib/texts';

	// Issue #368: institutions maintain a free-text explanation of how borrowing their
	// external items works. Only rendered for institutional accounts (gated by the parent).
	// Submits with the surrounding ?/saveProfile form via its name; empty clears the override
	// and the item page falls back to the shared default text.
	let { externalLendingInfo = '' }: { externalLendingInfo?: string } = $props();

	// Seed the editable textarea from the loaded value (it won't change during the page's life).
	// svelte-ignore state_referenced_locally
	let value = $state(externalLendingInfo);
</script>

<div class="border-t pt-6 space-y-4">
	<!-- h3: sub-block of the "Kontakt" section card (which owns the h2). -->
	<h3 class="text-lg font-semibold text-tinte-900 dark:text-white">
		{texts.institutional.externalLendingInfoEditLabel}
	</h3>
	<p class="text-sm text-tinte-600 dark:text-tinte-400">
		{texts.institutional.externalLendingInfoEditHint}
	</p>

	<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
		<label
			for="externalLendingInfo"
			class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white"
		>
			{texts.institutional.externalLendingInfoEditLabel}
		</label>
		<div class="sm:flex-1">
			<textarea
				name="externalLendingInfo"
				id="externalLendingInfo"
				rows="4"
				maxlength="1000"
				bind:value
				class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-y"
			></textarea>
		</div>
	</div>
</div>
