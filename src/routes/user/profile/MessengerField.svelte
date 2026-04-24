<script lang="ts">
	import { texts } from '$lib/texts';
	import { Label, Toggle, Popover } from 'flowbite-svelte';
	import { QuestionCircleSolid } from 'flowbite-svelte-icons';

	let {
		fieldName,
		label,
		placeholder,
		value,
		visibilityToggleName,
		visibilityToggleChecked,
		tooltipId,
		tooltipTitle,
		tooltipText,
	}: {
		fieldName: string;
		label: string;
		placeholder: string;
		value: string;
		visibilityToggleName: string;
		visibilityToggleChecked: boolean;
		/** Unique DOM id linking the tooltip trigger button to its Popover. */
		tooltipId: string;
		tooltipTitle: string;
		tooltipText: string;
	} = $props();
</script>

<div>
	<div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
		<Label class="sm:w-36 sm:shrink-0 flex items-center">
			<span class="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
			<button id={tooltipId}>
				<QuestionCircleSolid class="ml-1 h-5 w-5" />
				<span class="sr-only">{texts.ui.explainThis}</span>
			</button>
		</Label>
		<input
			type="text"
			name={fieldName}
			id={fieldName}
			{placeholder}
			{value}
			class="w-full sm:flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
			autocomplete="off"
		/>
	</div>
	<!-- On desktop, indent to align with the input column (sm:w-36 + sm:gap-4 = sm:pl-40) -->
	<div class="sm:pl-40 mt-2">
		<Label class="flex">
			<Toggle name={visibilityToggleName} checked={visibilityToggleChecked}>
				{texts.messenger.visibleToTrustedOnly}
			</Toggle>
		</Label>
	</div>
</div>

<Popover
	triggeredBy="#{tooltipId}"
	class="w-72 bg-white text-sm font-light text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
	placement="top-start"
>
	<div class="space-y-2 p-3">
		<h3 class="font-semibold text-gray-900 dark:text-white">{tooltipTitle}</h3>
		{tooltipText}
	</div>
</Popover>
