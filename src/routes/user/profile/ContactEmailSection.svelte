<script lang="ts">
	import { texts } from '$lib/texts';
	import { Toggle } from 'flowbite-svelte';

	// Issue #438: opt into email contact. Fields submit with the surrounding
	// ?/saveProfile form. The email input is always rendered so its value is
	// preserved across saves even while the toggle is off.
	let { contactViaEmail = false, contactEmail = '' }: { contactViaEmail?: boolean; contactEmail?: string } =
		$props();

	let enabled = $state(contactViaEmail);
</script>

<div class="border-t pt-6 space-y-4">
	<h2 class="text-lg font-semibold text-tinte-900 dark:text-white">
		{texts.emailContact.title}
	</h2>
	<div class="flex items-start justify-between gap-4">
		<div>
			<p class="text-sm font-medium text-tinte-900 dark:text-white">
				{texts.emailContact.toggleLabel}
			</p>
			<p class="text-sm text-tinte-600 dark:text-tinte-400 mt-1">
				{texts.emailContact.toggleDescription}
			</p>
		</div>
		<Toggle
			name="contactViaEmail"
			bind:checked={enabled}
			aria-label={texts.emailContact.toggleLabel}
			classes={{ span: 'bg-primary-300 peer-checked:bg-safety' }}
		/>
	</div>

	<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
		<label
			for="contactEmail"
			class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white"
		>
			{texts.emailContact.emailLabel}
		</label>
		<div class="sm:flex-1">
			<input
				type="email"
				name="contactEmail"
				id="contactEmail"
				value={contactEmail}
				required={enabled}
				placeholder={texts.emailContact.emailPlaceholder}
				class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
			/>
			<p class="text-sm text-tinte-600 dark:text-tinte-400 mt-1">
				{texts.emailContact.emailHelp}
			</p>
		</div>
	</div>
</div>
