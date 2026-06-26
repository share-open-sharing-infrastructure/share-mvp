<script lang="ts">
	import { texts } from '$lib/texts';
	import { Button, Toggle } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import type { RequirementSetting } from '$lib/types/models';

	let { settings = [] }: { settings?: RequirementSetting[] } = $props();

	// Local, controlled copies (keyed by field) so the toggles reflect user flips
	// before saving. Initialised from the loaded settings.
	let values = $state(Object.fromEntries(settings.map((s) => [s.field, s.enabled])));
</script>

<div class="max-w-2xl mx-auto px-4 pb-8">
	<div class="bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-6 sm:p-8">
		<h2 class="text-lg font-semibold text-tinte-900 dark:text-white mb-2">
			{texts.lendingRequirements.sectionTitle}
		</h2>
		<p class="text-sm text-tinte-600 dark:text-tinte-400 mb-4">
			{texts.lendingRequirements.sectionIntro}
		</p>

		<form
			method="POST"
			action="?/saveLendingRequirements"
			use:enhance={() => async ({ update }) => { await update({ reset: false }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
		>
			{#each settings as setting (setting.key)}
				<div class="flex items-center justify-between gap-4 border-t border-tinte-200 dark:border-tinte-700 pt-4 mt-4 first:mt-0">
					<div>
						<p class="text-sm font-medium text-tinte-900 dark:text-white">
							{setting.settingsLabel}
						</p>
						<p class="text-sm text-tinte-600 dark:text-tinte-400 mt-1">
							{setting.settingsHelp}
						</p>
					</div>
					<Toggle
						name={setting.field}
						bind:checked={values[setting.field]}
						classes={{ span: 'bg-primary-300 peer-checked:bg-safety' }}
					/>
				</div>
			{/each}

			<div class="pt-4 flex justify-end">
				<Button class="min-button bg-primary-200 hover:bg-primary" type="submit">
					{texts.buttons.save}
				</Button>
			</div>
		</form>
	</div>
</div>
