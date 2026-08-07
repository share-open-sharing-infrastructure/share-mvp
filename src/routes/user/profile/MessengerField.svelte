<script lang="ts">
	import { texts } from '$lib/texts';
	import { Label, Toggle, Popover } from 'flowbite-svelte';
	import { QuestionCircleSolid } from 'flowbite-svelte-icons';

	let {
		fieldName,
		label,
		placeholder,
		initialValue,
		visibilityToggleName,
		visibilityToggleChecked,
		tooltipId,
		tooltipTitle,
		tooltipText,
	}: {
		fieldName: string;
		label: string;
		placeholder: string;
		/** Named `initialValue`, not `value`: the seed-once `$state` below is named `value`
		 *  (so the input can use the bare `bind:value` shorthand), and a prop also named
		 *  `value` would make `let value = $state(value)` a duplicate `let value`
		 *  declaration in the same scope — a compile-time parse error, not shadowing
		 *  (which needs two distinct scopes). Renaming the prop instead of the local also
		 *  makes the seed-once contract visible at the call site (precedent: AddressInput's
		 *  `initialValue`) — see docs/best-practices.md → "Editable fields" → escape hatch. */
		initialValue: string;
		visibilityToggleName: string;
		visibilityToggleChecked: boolean;
		/** Unique DOM id linking the tooltip trigger button to its Popover. */
		tooltipId: string;
		tooltipTitle: string;
		tooltipText: string;
	} = $props();

	// Issue #558: seed once from initialValue and bind: from then on — never a one-way
	// value={…}, which hydration would clobber (see docs/best-practices.md → "Editable
	// fields: seed-once + bind:, never one-way value=").
	// svelte-ignore state_referenced_locally
	let value = $state(initialValue);
</script>

<div>
	<div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
		<Label for={fieldName} class="sm:w-36 sm:shrink-0 flex items-center">
			<span class="text-sm font-medium text-tinte-900 dark:text-white"
				>{label}</span
			>
			<button type="button" id={tooltipId}>
				<QuestionCircleSolid class="ml-1 h-5 w-5" />
				<span class="sr-only">{texts.ui.explainThis}</span>
			</button>
		</Label>
		<input
			type="text"
			name={fieldName}
			id={fieldName}
			{placeholder}
			bind:value
			class="w-full sm:flex-1 px-3 py-2 bg-papier border border-tinte-300 rounded-lg text-tinte-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-tinte-700 dark:border-tinte-600 dark:text-white"
			autocomplete="off"
		/>
	</div>
	<!-- On desktop, indent to align with the input column (sm:w-36 + sm:gap-4 = sm:pl-40) -->
	<div class="sm:pl-40 mt-2">
		<Label class="flex">
			<!-- One-way checked= is intentional, not an #558 miss: Flowbite's Toggle declares
			     `checked = $bindable()` and binds its own underlying checkbox internally, so
			     bind_checked's hydration guard already adopts a pre-hydration click — no
			     seed-once $state needed here. -->
			<Toggle classes={{ span: 'bg-primary-300 peer-checked:bg-safety' }} name={visibilityToggleName} checked={visibilityToggleChecked}>
				{texts.messenger.visibleToTrustedOnly}
			</Toggle>
		</Label>
	</div>
</div>

<Popover
	triggeredBy="#{tooltipId}"
	class="w-72 bg-papier text-sm font-light text-tinte-500 dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-400"
	placement="top-start"
>
	<div class="space-y-2 p-3">
		<h3 class="font-semibold text-tinte-900 dark:text-white">{tooltipTitle}</h3>
		{tooltipText}
	</div>
</Popover>
