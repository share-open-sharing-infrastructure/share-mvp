<script lang="ts">
	import { texts } from '$lib/texts';
	import { Toggle } from 'flowbite-svelte';
	import type { RequirementSetting } from '$lib/types/models';

	let { settings = [] }: { settings?: RequirementSetting[] } = $props();

	// Local, controlled copies (keyed by field) so the toggles reflect user flips
	// before saving. Initialised from the loaded settings. The toggles are part of
	// the parent settings form and persist via the shared save bar (?/saveProfile).
	let values = $state(
		Object.fromEntries(settings.map((s) => [s.field, s.enabled]))
	);
</script>

<h2 class="text-lg font-semibold text-tinte-900 dark:text-white">
	{texts.lendingRequirements.sectionTitle}
</h2>
<p class="mt-2 text-sm text-tinte-600 dark:text-tinte-400">
	{texts.lendingRequirements.sectionIntro}
</p>

<div class="mt-4">
	{#each settings as setting (setting.key)}
		<div
			class="flex items-center justify-between gap-4 border-t border-tinte-200 dark:border-tinte-700 pt-4 mt-4 first:mt-0 first:border-t-0 first:pt-0"
		>
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
</div>
