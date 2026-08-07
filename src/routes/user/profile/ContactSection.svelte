<script lang="ts">
	import { texts } from '$lib/texts';
	import { Toggle } from 'flowbite-svelte';

	// Issue #438: opt into an off-platform contact channel. Fields submit with the
	// surrounding ?/saveProfile form. Both contactEmail/contactUrl are always rendered — one
	// visible, one hidden — so the field name is always present in the FormData; see the
	// seed-once comment below for what actually happens to that value on save.
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

	// Pre-existing (not #558): svelte-check reports state_referenced_locally here too, since
	// `method`/`isPublic` are also seeded once from a prop and never re-synced. Ignored for
	// the same reason as the #558 seeds below.
	// svelte-ignore state_referenced_locally
	let method = $state<'' | 'email' | 'link'>(contactMethod);
	// svelte-ignore state_referenced_locally
	let isPublic = $state(contactPublic);

	// Issue #558: seed once from the loaded value and bind: from then on — never a one-way
	// value={…}, which hydration would clobber (see docs/best-practices.md → "Editable
	// fields: seed-once + bind:, never one-way value="). The hidden fallback inputs below
	// (still one-way — they're never user-edited) now read these local values instead of the
	// original props. This is a client-side-only improvement: switching the contact method
	// away and back re-mounts the visible input from the edited local state instead of
	// reverting to the originally-loaded prop value. It does NOT change what gets persisted —
	// parseOffPlatformContact ($lib/server/profileForm.ts) unconditionally zeroes whichever
	// method isn't the active one, regardless of what either input carries.
	// svelte-ignore state_referenced_locally
	let contactEmailValue = $state(contactEmail);
	// svelte-ignore state_referenced_locally
	let contactUrlValue = $state(contactUrl);
</script>

<div class="border-t pt-6 space-y-4">
	<!-- h3: this is a sub-block of the "Kontakt" section card (which owns the h2). -->
	<h3 class="text-lg font-semibold text-tinte-900 dark:text-white">
		{texts.contactOptions.title}
	</h3>
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
					bind:value={contactEmailValue}
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
		<!-- Client-side only (see the seed-once comment above): keeps the edited value ready
		     in case the user switches back to 'email' within this page view. This does NOT
		     preserve an existing address in the database — parseOffPlatformContact discards
		     this field's submitted value whenever contactMethod isn't 'email', regardless of
		     what it carries. -->
		<input type="hidden" name="contactEmail" value={contactEmailValue} />
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
					bind:value={contactUrlValue}
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
		<!-- Client-side only, same reasoning as the contactEmail fallback above: the server
		     discards this field's submitted value whenever contactMethod isn't 'link',
		     regardless of what it carries. -->
		<input type="hidden" name="contactUrl" value={contactUrlValue} />
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
