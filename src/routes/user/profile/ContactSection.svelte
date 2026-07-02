<script lang="ts">
	import { texts } from '$lib/texts';
	import { Toggle } from 'flowbite-svelte';

	// Issue #438: opt into an off-platform contact channel. Fields submit with the
	// surrounding ?/saveProfile form. Both inputs are always rendered so their values are
	// preserved across saves even while another method is selected.
	let {
		contactMethod = '',
		contactEmail = '',
		contactUrl = '',
		contactPublic = false,
	}: {
		contactMethod?: '' | 'email' | 'link';
		contactEmail?: string;
		contactUrl?: string;
		contactPublic?: boolean;
	} = $props();

	let method = $state<'' | 'email' | 'link'>(contactMethod);
	let isPublic = $state(contactPublic);
</script>

<div class="border-t pt-6 space-y-4">
	<h2 class="text-lg font-semibold text-tinte-900 dark:text-white">
		{texts.contactOptions.title}
	</h2>
	<p class="text-sm text-tinte-600 dark:text-tinte-400">
		{texts.contactOptions.description}
	</p>

	<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
		<label
			for="contactMethod"
			class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white"
		>
			{texts.contactOptions.methodLabel}
		</label>
		<div class="sm:flex-1">
			<select
				name="contactMethod"
				id="contactMethod"
				bind:value={method}
				class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
			>
				<option value="">{texts.contactOptions.methodOff}</option>
				<option value="email">{texts.contactOptions.methodEmail}</option>
				<option value="link">{texts.contactOptions.methodLink}</option>
			</select>
		</div>
	</div>

	{#if method === 'email'}
		<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
			<label
				for="contactEmail"
				class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white"
			>
				{texts.contactOptions.emailLabel}
			</label>
			<div class="sm:flex-1">
				<input
					type="email"
					name="contactEmail"
					id="contactEmail"
					value={contactEmail}
					required
					placeholder={texts.contactOptions.emailPlaceholder}
					class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
				/>
				<p class="text-sm text-tinte-600 dark:text-tinte-400 mt-1">
					{texts.contactOptions.emailHelp}
				</p>
			</div>
		</div>
	{:else}
		<!-- Always submit the email so an existing address is preserved while 'link' is selected. -->
		<input type="hidden" name="contactEmail" value={contactEmail} />
	{/if}

	{#if method === 'link'}
		<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
			<label
				for="contactUrl"
				class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white"
			>
				{texts.contactOptions.urlLabel}
			</label>
			<div class="sm:flex-1">
				<input
					type="url"
					name="contactUrl"
					id="contactUrl"
					value={contactUrl}
					required
					placeholder={texts.contactOptions.urlPlaceholder}
					class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
				/>
				<p class="text-sm text-tinte-600 dark:text-tinte-400 mt-1">
					{texts.contactOptions.urlHelp}
				</p>
			</div>
		</div>
	{:else}
		<input type="hidden" name="contactUrl" value={contactUrl} />
	{/if}

	{#if method !== ''}
		<div class="flex items-start justify-between gap-4">
			<div>
				<p class="text-sm font-medium text-tinte-900 dark:text-white">
					{texts.contactOptions.publicLabel}
				</p>
				<p class="text-sm text-tinte-600 dark:text-tinte-400 mt-1">
					{texts.contactOptions.publicHelp}
				</p>
			</div>
			<Toggle
				name="contactPublic"
				bind:checked={isPublic}
				aria-label={texts.contactOptions.publicLabel}
				classes={{ span: 'bg-primary-300 peer-checked:bg-safety' }}
			/>
		</div>
	{/if}
</div>
