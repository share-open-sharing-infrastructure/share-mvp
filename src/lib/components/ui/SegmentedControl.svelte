<script lang="ts" generics="T extends string">
	interface Option {
		value: T;
		label: string;
	}

	interface Props {
		options: Option[];
		value: T;
		onchange?: (value: T) => void;
		/** Accessible name for the group (visually hidden if no visible legend is nearby). */
		label: string;
		/** Nur Layout-Klassen (Breite, Abstand, Positionierung) — nie Farben. */
		class?: string;
	}

	let { options, value = $bindable(), onchange, label, class: className = '' }: Props = $props();

	function select(next: T) {
		value = next;
		onchange?.(next);
	}
</script>

<!-- Roving tabindex / arrow-key navigation intentionally out of scope for this fix. -->
<div role="radiogroup" aria-label={label} class="inline-flex flex-wrap gap-2 {className}">
	{#each options as option (option.value)}
		{@const active = option.value === value}
		<button
			type="button"
			role="radio"
			aria-checked={active}
			onclick={() => select(option.value)}
			class="rounded-full border px-3 py-1 text-sm font-medium transition-colors cursor-pointer
				{active
				? 'bg-primary border-primary text-white'
				: 'border-tinte-300 bg-papier text-tinte-700 hover:border-primary hover:text-primary dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-300 dark:hover:border-primary dark:hover:text-primary'}"
		>
			{option.label}
		</button>
	{/each}
</div>
